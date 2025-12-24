import { AutomationStorage, Scenario } from "./automationStorage";

const DAYS_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export class AutomationScheduler {
  private static interval: ReturnType<typeof setInterval> | null = null;
  private static onTriggerCallback: ((scenario: Scenario) => void) | null =
    null;
  private static lastTriggered: Map<string, number> = new Map();
  private static readonly TRIGGER_COOLDOWN = 60000; // 60 seconds cooldown

  /**
   * Start the automation scheduler
   * Syncs to minute boundaries for accurate timing
   */
  static start(onTrigger: (scenario: Scenario) => void) {
    this.onTriggerCallback = onTrigger;

    if (this.interval) {
      clearInterval(this.interval);
    }

    console.log("🕒 Automation scheduler starting.. .");

    // Calculate milliseconds until next minute
    const now = new Date();
    const currentSeconds = now.getSeconds();
    const currentMilliseconds = now.getMilliseconds();
    const msUntilNextMinute =
      (60 - currentSeconds) * 1000 - currentMilliseconds;

    // Wait until the next minute boundary, then start checking
    setTimeout(() => {
      // Check immediately at the minute boundary
      this.checkAutomations();

      // Then check every 60 seconds
      this.interval = setInterval(() => {
        this.checkAutomations();
      }, 60000);
    }, msUntilNextMinute);
  }

  /**
   * Stop the scheduler
   */
  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.lastTriggered.clear();
    }
  }

  /**
   * Check if a scenario can be triggered (not in cooldown)
   */
  private static canTrigger(scenarioId: string): boolean {
    const lastTriggerTime = this.lastTriggered.get(scenarioId);

    if (!lastTriggerTime) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTime;

    return timeSinceLastTrigger >= this.TRIGGER_COOLDOWN;
  }

  /**
   * Mark a scenario as triggered
   */
  private static markTriggered(scenarioId: string) {
    this.lastTriggered.set(scenarioId, Date.now());
  }

  /**
   * Check if any automations should trigger now
   */
  private static async checkAutomations() {
    try {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const currentDay = this.getDayId(now.getDay());
      const currentSeconds = now.getSeconds();

      console.log(
        `⏰ Checking automations at ${currentTime}: ${currentSeconds.toString().padStart(2, "0")} (${currentDay})`
      );

      const scenarios = await AutomationStorage.getScenarios();
      let triggeredCount = 0;

      for (const scenario of scenarios) {
        // Skip if not enabled or no trigger time
        if (!scenario.enabled || !scenario.trigger_time) {
          continue;
        }

        // Check if time matches
        if (scenario.trigger_time !== currentTime) {
          continue;
        }

        // Check if today is in trigger days
        if (
          scenario.trigger_days &&
          scenario.trigger_days.length > 0 &&
          !scenario.trigger_days.includes(currentDay)
        ) {
          continue;
        }

        // Check if scenario is in cooldown
        if (!this.canTrigger(scenario.id)) {
          continue;
        }

        // Trigger the automation!

        // Mark as triggered BEFORE executing
        this.markTriggered(scenario.id);
        triggeredCount++;

        if (this.onTriggerCallback) {
          try {
            await this.onTriggerCallback(scenario);
          } catch (error) {
            console.error(
              `❌ Error executing automation: ${scenario.name}`,
              error
            );
          }
        }
      }

      if (triggeredCount === 0) {
      }
    } catch (error) {}
  }

  /**
   * Convert day number to day ID
   */
  private static getDayId(dayNumber: number): string {
    const dayIds = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return dayIds[dayNumber];
  }

  /**
   * Manually trigger a scenario (bypass cooldown)
   */
  static async manualTrigger(scenario: Scenario): Promise<void> {
    if (this.onTriggerCallback) {
      try {
        await this.onTriggerCallback(scenario);
        console.log(`✅ Manual trigger successful: ${scenario.name}`);
      } catch (error) {
        console.error(`❌ Manual trigger failed: ${scenario.name}`, error);
        throw error;
      }
    }
  }

  /**
   * Reset cooldown for a specific scenario
   */
  static resetCooldown(scenarioId: string): void {
    this.lastTriggered.delete(scenarioId);
    console.log(`🔄 Cooldown reset for scenario: ${scenarioId}`);
  }

  /**
   * Reset all cooldowns
   */
  static resetAllCooldowns(): void {
    this.lastTriggered.clear();
  }

  /**
   * Get time until scenario can trigger again
   */
  static getTimeUntilNextTrigger(scenarioId: string): number {
    const lastTriggerTime = this.lastTriggered.get(scenarioId);

    if (!lastTriggerTime) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTime;
    const remainingCooldown = this.TRIGGER_COOLDOWN - timeSinceLastTrigger;

    return Math.max(0, remainingCooldown);
  }

  /**
   * Clean up old trigger records (older than 24 hours)
   */
  static cleanupOldTriggers(): void {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    for (const [scenarioId, triggerTime] of this.lastTriggered.entries()) {
      if (triggerTime < oneDayAgo) {
        this.lastTriggered.delete(scenarioId);
        console.log(`🧹 Cleaned up old trigger record: ${scenarioId}`);
      }
    }
  }

  /**
   * Get current time in HH:MM format
   */
  static getCurrentTime(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Get current day ID
   */
  static getCurrentDay(): string {
    const now = new Date();
    return this.getDayId(now.getDay());
  }
}
