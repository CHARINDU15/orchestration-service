const { createStrategy } = require('../strategies/StrategyFactory');
const { runRules } = require('../rules/RuleEngine');

class PricingEngineService {
  constructor(deps) {
    this.deps = deps;
  }

  async calculate(payload) {
    const strategy = createStrategy(payload.serviceType, this.deps);
    const rules = strategy.getRules();
    return runRules(rules, payload);
  }
}

module.exports = PricingEngineService;
