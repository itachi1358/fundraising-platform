export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Validation failed', errors: result.error.flatten().fieldErrors });
    }
    req.body = result.data;
    next();
  };
}

// Query strings are user input too. Keep their parsed form separate from
// Express's request object so handlers can rely on a typed, validated value.
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ message: 'Validation failed', errors: result.error.flatten().fieldErrors });
    }
    req.validatedQuery = result.data;
    next();
  };
}
