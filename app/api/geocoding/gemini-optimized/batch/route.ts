import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { batchProcessor } from "@/lib/batch-processor";

interface BatchGeminiRequest {
  addresses: Array<{
    address: string;
    city: string;
    county: string;
  }>;
  options?: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
  };
}

interface GeminiResult {
  address: string;
  city: string;
  county: string;
  success: boolean;
  neighborhood?: string;
  community?: string;
  error?: string;
  processing_time_ms?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BatchGeminiRequest = await request.json();
    const { addresses, options = {} } = body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "Addresses array required" },
        { status: 400 }
      );
    }

    console.log(
      `[BATCH-GEMINI] Starting batch processing of ${addresses.length} addresses`
    );

    // Configurar el batch processor con opciones específicas para Gemini
    const geminiConfig = {
      batchSize: options.batchSize || 20, // Menor batch size para Gemini
      concurrency: options.concurrency || 5, // Menor concurrencia para Gemini
      delayBetweenBatches: options.delayBetweenBatches || 200, // Más delay para Gemini
    };

    batchProcessor.updateConfig(geminiConfig);

    const startTime = Date.now();

    // Procesador individual para cada dirección
    const geminiProcessor = async (
      addressData: (typeof addresses)[0]
    ): Promise<GeminiResult> => {
      try {
        const response = await fetch(
          `${getBaseUrl(request)}/api/geocoding/gemini-optimized`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: request.headers.get("Authorization") || "",
              Cookie: request.headers.get("Cookie") || "",
            },
            body: JSON.stringify(addressData),
          }
        );

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit específico - relanzar error para retry
            throw new Error(`Rate limit exceeded (429)`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          return {
            address: addressData.address,
            city: addressData.city,
            county: addressData.county,
            success: true,
            neighborhood: data.data?.neighborhood || null,
            community: data.data?.community || null,
            processing_time_ms: data.processing_time_ms,
          };
        } else {
          return {
            address: addressData.address,
            city: addressData.city,
            county: addressData.county,
            success: false,
            error: data.error || "Unknown error",
          };
        }
      } catch (error: unknown) {
        return {
          address: addressData.address,
          city: addressData.city,
          county: addressData.county,
          success: false,
          error: error instanceof Error ? error.message : "Network error",
        };
      }
    };

    // Callback de progreso
    const onProgress = (processed: number, total: number, errors: number) => {
      const percentage = Math.round((processed / total) * 100);
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);

      console.log(
        `[BATCH-GEMINI] Progress: ${processed}/${total} (${percentage}%) - Rate: ${rate.toFixed(2)} addresses/sec - Errors: ${errors}`
      );
    };

    // Procesar en batches
    const { results } = await batchProcessor.processBatch(
      addresses,
      geminiProcessor,
      onProgress
    );

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    const avgRate = addresses.length / totalTime;
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    console.log(
      `[BATCH-GEMINI] Completed: ${addresses.length} addresses in ${totalTime.toFixed(2)}s`
    );
    console.log(
      `[BATCH-GEMINI] Success: ${successCount}, Errors: ${errorCount}, Rate: ${avgRate.toFixed(2)} addr/sec`
    );

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: addresses.length,
        successful: successCount,
        failed: errorCount,
        processingTime: totalTime,
        averageRate: avgRate,
        provider: "gemini-optimized",
        environment: batchProcessor.getEnvironment().isRailway
          ? "Railway"
          : "localhost",
        config: batchProcessor.getConfig(),
      },
    });
  } catch (error) {
    console.error("Batch Gemini processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getBaseUrl(request: NextRequest): string {
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}
