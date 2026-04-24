const runRules = async (rules, state) => {
  let current = { ...state };

  for (const rule of rules) {
    current = await rule.apply(current);
  }

  return current;
};

module.exports = {
  runRules
};
