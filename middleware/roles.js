// middleware/roles.js

// Allow only ONE specific role
function requireRole(role) {
  return (req, res, next) => {
    


    if (req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// Allow ANY of multiple roles
function requireRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { requireRole, requireRoles };