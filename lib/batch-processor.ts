import { setTimeout } from "timers/promises";

interface BatchConfig {
  maxBatchSize: number;
  concurrency: number;
  delayBetweenBatches: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ProcessingEnvironment {
  isRailway: boolean;
  availableMemory: number;
  cpuCores: number;
}

interface BatchError {
  index: number;
  error: unknown;
}

export class BatchProcessor {
  private config: BatchConfig;
  private environment: ProcessingEnvironment;

  constructor() {
    this.environment = this.detectEnvironment();
    this.config = this.getOptimalConfig();
  }

  private detectEnvironment(): ProcessingEnvironment {
    const isRailway =
      process.env.RAILWAY_ENVIRONMENT === "production" ||
      process.env.NODE_ENV === "production";

    // Railway: 8GB RAM, 8 vCPU vs Localhost: menor capacidad
    return {
      isRailway,
      availableMemory: isRailway ? 8192 : 2048, // MB
      cpuCores: isRailway ? 8 : 4,
    };
  }

  private getOptimalConfig(): BatchConfig {
    if (this.environment.isRailway) {
      // Configuración agresiva para Railway
      return {
        maxBatchSize: 50, // Batches más grandes
        concurrency: 8, // Más requests simultáneos
        delayBetweenBatches: 100, // Menor delay
        retryAttempts: 5,
        retryDelay: 1000,
      };
    } else {
      // Configuración conservadora para localhost
      return {
        maxBatchSize: 10, // Batches más pequeños
        concurrency: 3, // Menos concurrent requests
        delayBetweenBatches: 500, // Mayor delay
        retryAttempts: 3,
        retryDelay: 2000,
      };
    }
  }

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    onProgress?: (processed: number, total: number, errors: number) => void
  ): Promise<{ results: R[]; errors: BatchError[] }> {
    const results: R[] = [];
    const errors: BatchError[] = [];
    let processed = 0;

    console.log(
      `[BATCH-PROCESSOR] Starting batch processing on ${this.environment.isRailway ? "Railway" : "localhost"}`
    );
    console.log(`[BATCH-PROCESSOR] Config: ${JSON.stringify(this.config)}`);
    console.log(`[BATCH-PROCESSOR] Total items: ${items.length}`);

    // Dividir en chunks
    for (let i = 0; i < items.length; i += this.config.maxBatchSize) {
      const chunk = items.slice(i, i + this.config.maxBatchSize);

      console.log(
        `[BATCH-PROCESSOR] Processing chunk ${Math.floor(i / this.config.maxBatchSize) + 1}/${Math.ceil(items.length / this.config.maxBatchSize)}`
      );

      // Procesar chunk con concurrencia limitada
      const chunkResults = await this.processChunkWithConcurrency(
        chunk,
        processor
      );

      results.push(...chunkResults.results);
      errors.push(...chunkResults.errors);
      processed += chunk.length;

      // Callback de progreso
      if (onProgress) {
        onProgress(processed, items.length, errors.length);
      }

      // Delay entre batches para evitar rate limiting
      if (i + this.config.maxBatchSize < items.length) {
        await setTimeout(this.config.delayBetweenBatches);
      }
    }

    return { results, errors };
  }

  private async processChunkWithConcurrency<T, R>(
    chunk: T[],
    processor: (item: T) => Promise<R>
  ): Promise<{ results: R[]; errors: BatchError[] }> {
    const results: R[] = [];
    const errors: BatchError[] = [];

    // Dividir chunk en grupos para concurrencia limitada
    for (let i = 0; i < chunk.length; i += this.config.concurrency) {
      const group = chunk.slice(i, i + this.config.concurrency);

      const promises = group.map(async (item, index) => {
        return this.processWithRetry(item, processor, index);
      });

      const groupResults = await Promise.allSettled(promises);

      groupResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.error(
            `[BATCH-PROCESSOR] Error processing item ${i + index}:`,
            result.reason
          );
          errors.push({ index: i + index, error: result.reason });
        }
      });

      // Pequeño delay entre grupos concurrentes
      if (i + this.config.concurrency < chunk.length) {
        await setTimeout(50);
      }
    }

    return { results, errors };
  }

  private async processWithRetry<T, R>(
    item: T,
    processor: (item: T) => Promise<R>,
    index: number
  ): Promise<R> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await processor(item);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[BATCH-PROCESSOR] Attempt ${attempt}/${this.config.retryAttempts} failed for item ${index}:`,
          errorMessage
        );

        // Si es error 429 (rate limit), usar delay exponencial
        const hasRateLimit =
          (error &&
            typeof error === "object" &&
            "status" in error &&
            error.status === 429) ||
          errorMessage.includes("429");

        if (hasRateLimit) {
          const backoffDelay =
            this.config.retryDelay * Math.pow(2, attempt - 1);
          console.log(
            `[BATCH-PROCESSOR] Rate limit hit, backing off for ${backoffDelay}ms`
          );
          await setTimeout(backoffDelay);
        } else if (attempt < this.config.retryAttempts) {
          await setTimeout(this.config.retryDelay);
        }

        if (attempt === this.config.retryAttempts) {
          throw error;
        }
      }
    }
    throw new Error("Max retries exceeded");
  }

  // Método para ajustar configuración dinámicamente
  updateConfig(newConfig: Partial<BatchConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log(`[BATCH-PROCESSOR] Configuration updated:`, this.config);
  }

  getConfig(): BatchConfig {
    return { ...this.config };
  }

  getEnvironment(): ProcessingEnvironment {
    return { ...this.environment };
  }
}

// Singleton instance
export const batchProcessor = new BatchProcessor();
