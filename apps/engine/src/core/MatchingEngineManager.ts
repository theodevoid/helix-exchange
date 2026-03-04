import { EngineEvent, PlaceLimitOrder } from "../types";
import { MatchingEngine } from "./MatchingEngine";

export class MatchingEngineManager {
  private engines: Map<string, MatchingEngine> = new Map();

  private getEngine(marketId: string): MatchingEngine {
    if (!this.engines.has(marketId)) {
      this.engines.set(marketId, new MatchingEngine(marketId));
    }

    return this.engines.get(marketId)!;
  }

  process(command: PlaceLimitOrder): EngineEvent[] {
    const engine = this.getEngine(command.marketId);

    return engine.process(command);
  }
}
