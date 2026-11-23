// OpenAPI 3 description of the Lumen Quest API, served at /api/openapi.json and rendered at /api/docs.

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const msg = (description) => ({ description, ...json(ref('Message')) });

const ERR = {
  400: msg('Invalid input'),
  401: msg('Missing access token'),
  403: msg('Invalid/expired token or insufficient role'),
  404: msg('Not found'),
  409: msg('Conflict'),
  429: msg('Rate limit exceeded'),
};

const idParam = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'integer' } });

// [method, path, tag, summary, { auth, body, ok, params, errors, query, description }]
const ROUTES = [
  ['get', '/api/health', 'System', 'API and database health', { ok: json({ type: 'object', properties: { status: { type: 'string' }, database: { type: 'string' } } }) }],

  ['post', '/api/auth/register', 'Auth', 'Create a customer account', {
    body: ref('RegisterInput'), status: 201,
    ok: json({ type: 'object', properties: { message: { type: 'string' }, userId: { type: 'integer' }, welcomeEmailSent: { type: 'boolean' } } }),
    errors: [400, 409, 429], description: 'Rate limited to 10 sign-ups per hour per IP. Sends a welcome email when SMTP is configured.',
  }],
  ['post', '/api/auth/login', 'Auth', 'Sign in and receive tokens', {
    body: ref('LoginInput'), ok: json(ref('LoginResult')), errors: [400, 401, 429],
    description: 'Access tokens last 15 minutes, refresh tokens 7 days. After 5 failed attempts for an email, sign-in is blocked for 15 minutes.',
  }],
  ['post', '/api/auth/google', 'Auth', 'Sign in with Google (customers)', {
    body: { type: 'object', required: ['credential'], properties: { credential: { type: 'string', description: 'Google ID token from Google Identity Services' } } },
    ok: json(ref('LoginResult')), errors: [400, 401, 403, 429],
    description: 'Verifies the Google ID token, then signs in or creates the customer account. Admin accounts are rejected. Returns 503 until GOOGLE_CLIENT_ID is configured.',
  }],
  ['post', '/api/auth/refresh', 'Auth', 'Exchange a refresh token for a new access token', {
    body: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
    ok: json({ type: 'object', properties: { accessToken: { type: 'string' } } }), errors: [401, 403],
  }],
  ['post', '/api/auth/logout', 'Auth', 'Sign out (client discards tokens)', { ok: msg('Logged out') }],

  ['get', '/api/users/me', 'Account', 'My profile', { auth: true, ok: json(ref('User')), errors: [401, 403, 404] }],
  ['put', '/api/users/me', 'Account', 'Update my profile or password', {
    auth: true, body: ref('ProfileInput'), ok: msg('Updated'), errors: [400, 401, 403],
    description: 'Changing the password requires `current_password`.',
  }],
  ['delete', '/api/users/me', 'Account', 'Delete my account', { auth: true, ok: msg('Deleted'), errors: [401, 403] }],

  ['get', '/api/plans', 'Plans', 'List plans', { ok: json({ type: 'array', items: ref('Plan') }) }],
  ['get', '/api/plans/{id}', 'Plans', 'Get a plan', { params: [idParam('id', 'Plan ID')], ok: json(ref('Plan')), errors: [404] }],
  ['post', '/api/plans', 'Plans', 'Create a plan', { auth: 'admin', body: ref('PlanInput'), status: 201, ok: json({ type: 'object', properties: { planId: { type: 'integer' } } }), errors: [400, 401, 403] }],
  ['put', '/api/plans/{id}', 'Plans', 'Update a plan', { auth: 'admin', params: [idParam('id', 'Plan ID')], body: ref('PlanInput'), ok: msg('Updated'), errors: [400, 401, 403, 404] }],
  ['delete', '/api/plans/{id}', 'Plans', 'Delete a plan', { auth: 'admin', params: [idParam('id', 'Plan ID')], ok: msg('Deleted'), errors: [401, 403, 404, 409], description: 'Returns 409 if the plan has subscription history.' }],

  ['get', '/api/subscriptions/me', 'Subscriptions', 'My subscriptions', { auth: true, ok: json({ type: 'array', items: ref('Subscription') }) }],
  ['get', '/api/subscriptions/me/summary', 'Subscriptions', 'Overview with plan suggestions', { auth: true, ok: json({ type: 'object' }) }],
  ['get', '/api/subscriptions/me/billing', 'Subscriptions', 'My bills', { auth: true, ok: json({ type: 'array', items: ref('Bill') }) }],
  ['post', '/api/subscriptions/me/billing/{id}/pay', 'Subscriptions', 'Pay a pending or failed bill', { auth: true, params: [idParam('id', 'Billing ID')], body: ref('PaymentInput'), ok: msg('Paid'), errors: [404] }],
  ['post', '/api/subscriptions', 'Subscriptions', 'Subscribe or switch plan', {
    auth: true, body: { type: 'object', required: ['plan_id'], properties: { plan_id: { type: 'integer' }, payment_method: ref('PaymentMethod') } },
    status: 201, ok: json({ type: 'object' }), errors: [400, 404], description: 'Cancels any current subscription and records a paid bill in one transaction.',
  }],
  ['post', '/api/subscriptions/{id}/pause', 'Subscriptions', 'Pause my subscription', { auth: true, params: [idParam('id', 'Subscription ID')], ok: msg('Paused'), errors: [404] }],
  ['post', '/api/subscriptions/{id}/resume', 'Subscriptions', 'Resume my subscription', { auth: true, params: [idParam('id', 'Subscription ID')], ok: msg('Resumed'), errors: [404], description: 'The end date is extended by the number of days paused.' }],
  ['post', '/api/subscriptions/{id}/cancel', 'Subscriptions', 'Cancel my subscription', { auth: true, params: [idParam('id', 'Subscription ID')], ok: msg('Cancelled'), errors: [404] }],

  ['get', '/api/admin/stats', 'Admin', 'Dashboard metrics and charts', { auth: 'admin', ok: json({ type: 'object' }) }],
  ['get', '/api/admin/customers', 'Admin', 'List customers', { auth: 'admin', ok: json({ type: 'array', items: { type: 'object' } }) }],
  ['post', '/api/admin/customers', 'Admin', 'Create a customer', {
    auth: 'admin', status: 201, errors: [400, 409],
    body: { type: 'object', required: ['name', 'email'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' }, phone: { type: 'string' }, plan_id: { type: 'integer' } } },
    ok: json({ type: 'object', properties: { userId: { type: 'integer' }, tempPassword: { type: 'string' }, emailSent: { type: 'boolean' } } }),
  }],
  ['get', '/api/admin/customers/{id}', 'Admin', 'Customer detail', { auth: 'admin', params: [idParam('id', 'User ID')], ok: json({ type: 'object' }), errors: [404] }],
  ['patch', '/api/admin/customers/{id}', 'Admin', 'Set customer status', { auth: 'admin', params: [idParam('id', 'User ID')], body: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'inactive'] } } }, ok: msg('Updated'), errors: [400, 404] }],
  ['post', '/api/admin/customers/{id}/subscription', 'Admin', 'Assign or change a customer plan', { auth: 'admin', params: [idParam('id', 'User ID')], body: { type: 'object', properties: { plan_id: { type: 'integer' } } }, status: 201, ok: msg('Moved'), errors: [400, 404] }],
  ['post', '/api/admin/subscriptions/{id}/{action}', 'Admin', 'Pause, resume or cancel any subscription', {
    auth: 'admin', ok: msg('Done'), errors: [404, 409],
    params: [idParam('id', 'Subscription ID'), { name: 'action', in: 'path', required: true, schema: { type: 'string', enum: ['pause', 'resume', 'cancel'] } }],
  }],
  ['get', '/api/admin/billing', 'Admin', 'All bills', { auth: 'admin', query: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['paid', 'pending', 'failed'] } }], ok: json({ type: 'array', items: { type: 'object' } }) }],
  ['post', '/api/admin/billing/{id}/mark-paid', 'Admin', 'Mark a bill as paid', { auth: 'admin', params: [idParam('id', 'Billing ID')], body: ref('PaymentInput'), ok: msg('Marked paid'), errors: [404] }],
  ['get', '/api/admin/plans', 'Admin', 'Plans with subscriber counts', { auth: 'admin', ok: json({ type: 'array', items: ref('Plan') }) }],

  ['get', '/api/recommendations', 'Insights', 'Recommendations for every dataset user', { ok: json({ type: 'object' }) }],
  ['get', '/api/recommendations/{id}', 'Insights', 'Recommendation for one dataset user', { params: [idParam('id', 'Dataset user ID')], ok: json({ type: 'object' }), errors: [404] }],
];

const paths = {};
for (const [method, path, tag, summary, o] of ROUTES) {
  const op = { tags: [tag], summary };
  if (o.description) op.description = o.description;
  if (o.auth) {
    op.security = [{ bearerAuth: [] }];
    if (o.auth === 'admin') op.description = `**Admin only.** ${op.description || ''}`.trim();
  }
  const params = [...(o.params || []), ...(o.query || [])];
  if (params.length) op.parameters = params;
  if (o.body) op.requestBody = { required: true, ...json(o.body) };
  op.responses = { [o.status || 200]: { description: 'Success', ...(o.ok || {}) } };
  const errs = new Set([...(o.errors || []), ...(o.auth ? [401, 403] : []), 429]);
  for (const code of errs) op.responses[code] = ERR[code];
  (paths[path] = paths[path] || {})[method] = op;
}

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'SubsPro API',
    version: '1.0.0',
    description: 'Subscription management API for Lumen Quest. Sign in with **POST /api/auth/login**, then click **Authorize** and paste the `accessToken`.\n\nDemo accounts: `admin@lumen.com / admin123` (admin), `aman@example.com / password123` (customer).',
  },
  servers: [{ url: '/' }],
  tags: ['System', 'Auth', 'Account', 'Plans', 'Subscriptions', 'Admin', 'Insights'].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Message: { type: 'object', properties: { message: { type: 'string' } } },
      PaymentMethod: { type: 'string', enum: ['upi', 'credit_card', 'debit_card', 'cash'] },
      PaymentInput: { type: 'object', properties: { payment_method: ref('PaymentMethod') } },
      RegisterInput: {
        type: 'object', required: ['name', 'email', 'password'],
        properties: { name: { type: 'string', example: 'Asha Verma' }, email: { type: 'string', format: 'email', example: 'asha@example.com' }, password: { type: 'string', minLength: 8, example: 'password123' }, phone: { type: 'string' } },
      },
      LoginInput: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'aman@example.com' }, password: { type: 'string', example: 'password123' } } },
      LoginResult: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, user: ref('User') } },
      ProfileInput: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string', minLength: 8 }, current_password: { type: 'string' } } },
      User: {
        type: 'object',
        properties: { user_id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string', nullable: true }, role: { type: 'string', enum: ['user', 'admin'] }, status: { type: 'string', enum: ['active', 'inactive'] }, created_at: { type: 'string', format: 'date-time' } },
      },
      Plan: {
        type: 'object',
        properties: { plan_id: { type: 'integer' }, plan_name: { type: 'string' }, price: { type: 'number' }, quota_sessions: { type: 'integer' }, validity_days: { type: 'integer' }, auto_renewal_allowed: { type: 'string', enum: ['Yes', 'No'] }, description: { type: 'string', nullable: true }, status: { type: 'string', enum: ['Active', 'Inactive'] } },
      },
      PlanInput: {
        type: 'object', required: ['plan_name', 'price', 'quota_sessions'],
        properties: { plan_name: { type: 'string' }, price: { type: 'number', minimum: 0 }, quota_sessions: { type: 'integer', minimum: 0 }, validity_days: { type: 'integer', minimum: 1 }, auto_renewal_allowed: { type: 'string', enum: ['Yes', 'No'] }, description: { type: 'string' }, status: { type: 'string', enum: ['Active', 'Inactive'] } },
      },
      Subscription: {
        type: 'object',
        properties: { sub_id: { type: 'integer' }, plan_id: { type: 'integer' }, plan_name: { type: 'string' }, price: { type: 'number' }, status: { type: 'string', enum: ['active', 'paused', 'expired', 'cancelled'] }, start_date: { type: 'string', format: 'date' }, end_date: { type: 'string', format: 'date' } },
      },
      Bill: {
        type: 'object',
        properties: { billing_id: { type: 'integer' }, amount: { type: 'number' }, billing_date: { type: 'string', format: 'date' }, payment_status: { type: 'string', enum: ['paid', 'pending', 'failed'] }, payment_method: { type: 'string' }, plan_name: { type: 'string' } },
      },
    },
  },
};

const docsHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SubsPro API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css">
<style>body{margin:0;background:#f8fafc}.topbar{display:none}.swagger-ui .info .title{color:#0f172a}</style>
</head><body><div id="ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#ui', deepLinking: true, persistAuthorization: true, tryItOutEnabled: true });</script>
</body></html>`;

module.exports = { openapi, docsHtml };
