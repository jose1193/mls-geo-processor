import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { batchProcessor } from "@/lib/batch-processor";

interface BatchGeocodeRequest {
  addresses: string[];
  provider?: 'mapbox' | 'gemini' | 'geocodio';
  options?: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
  };
}

interface GeocodeResult {
  address: string;
  success: boolean;
  latitude?: number;
  longitude?: number;
  formatted?: string;
  error?: string;
  provider: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BatchGeocodeRequest = await request.json();
    const { addresses, provider = 'mapbox', options = {} } = body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json(
        { error: "Addresses array required" }, 
        { status: 400 }
      );
    }

    console.log(`[BATCH-GEOCODE] Starting batch geocoding of ${addresses.length} addresses using ${provider}`);

    // Configurar el batch processor con opciones personalizadas
    if (options.batchSize || options.concurrency || options.delayBetweenBatches) {
      batchProcessor.updateConfig({
        maxBatchSize: options.batchSize,
        concurrency: options.concurrency,
        delayBetweenBatches: options.delayBetweenBatches
      });
    }

    const startTime = Date.now();

    // Procesador individual para cada dirección
    const geocodeProcessor = async (address: string): Promise<GeocodeResult> => {
      try {
        const response = await fetch(`${getBaseUrl(request)}/api/geocoding/${provider}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({ address })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          return {
            address,
            success: true,
            latitude: data.latitude,
            longitude: data.longitude,
            formatted: data.formatted,
            provider
          };
        } else {
          return {
            address,
            success: false,
            error: data.error || 'Unknown error',
            provider
          };
        }
      } catch (error: unknown) {
        return {
          address,
          success: false,
          error: error instanceof Error ? error.message : 'Network error',
          provider
        };
      }
    };

    // Callback de progreso
    const onProgress = (processed: number, total: number, errors: number) => {
      const percentage = Math.round((processed / total) * 100);
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      
      console.log(`[BATCH-GEOCODE] Progress: ${processed}/${total} (${percentage}%) - Rate: ${rate.toFixed(2)} addresses/sec - Errors: ${errors}`);
    };

    // Procesar en batches
    const { results } = await batchProcessor.processBatch(
      addresses,
      geocodeProcessor,
      onProgress
    );

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    const avgRate = addresses.length / totalTime;
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`[BATCH-GEOCODE] Completed: ${addresses.length} addresses in ${totalTime.toFixed(2)}s`);
    console.log(`[BATCH-GEOCODE] Success: ${successCount}, Errors: ${errorCount}, Rate: ${avgRate.toFixed(2)} addr/sec`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: addresses.length,
        successful: successCount,
        failed: errorCount,
        processingTime: totalTime,
        averageRate: avgRate,
        provider,
        environment: batchProcessor.getEnvironment().isRailway ? 'Railway' : 'localhost',
        config: batchProcessor.getConfig()
      }
    });

  } catch (error) {
    console.error("Batch geocoding error:", error);
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
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}
