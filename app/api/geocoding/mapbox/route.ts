import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: Array<{ id: string; text: string }>;
  properties?: { neighborhood?: string };
}
interface MapboxResponseShape {
  features?: MapboxFeature[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: "Address required" }, { status: 400 });
    }

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      return NextResponse.json(
        { error: "Mapbox token not configured" },
        { status: 500 }
      );
    }

    const encodedAddress = encodeURIComponent(address);
    // Broaden types to increase hit rate if address parsing is imperfect
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=us&types=address,place,locality,neighborhood&limit=1&autocomplete=false`;

    console.log(`[MAPBOX-API] Geocoding: ${address.substring(0, 50)}...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MLS-Geo-Processor/1.0'
      }
    });
    
    let data: unknown = null;
    try {
      data = await response.json();
    } catch (e) {
      console.warn("Mapbox response JSON parse failed", e);
    }

    if (!response.ok) {
      const status = response.status;
      const baseError = `Mapbox API error: ${status}`;
      
      // Log para debugging rate limits
      console.warn(`[MAPBOX-API] Error ${status} for address: ${address}`);
      
      // Si es 429, incluir información específica
      if (status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        console.warn(`[MAPBOX-API] Rate limited. Retry after: ${retryAfter} seconds`);
        
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded",
            status: 429,
            retryAfter: retryAfter ? parseInt(retryAfter) : 60
          },
          { status: 429 }
        );
      }
      
      // Pass through specific status (401 usually invalid / restricted token)
      return NextResponse.json(
        {
          success: false,
          error:
            status === 401
              ? `${baseError} (token invalid, expired, or missing geocoding scope)`
              : baseError,
          status,
        },
        { status: 200 }
      );
    }

    const dataObj = data as MapboxResponseShape | null;
    if (!dataObj?.features || dataObj.features.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No results found",
      });
    }
    const feature = dataObj.features[0];
    const [longitude, latitude] = feature.center;

    // Extract neighborhood info from context
    let neighborhood: string | null = null;
    let locality: string | null = null;
    let place: string | null = null;
    let district: string | null = null;

    if (feature.context) {
      for (const ctx of feature.context) {
        if (ctx.id.startsWith("neighborhood"))
          neighborhood = neighborhood || ctx.text;
        else if (ctx.id.startsWith("locality")) locality = locality || ctx.text;
        else if (ctx.id.startsWith("place")) place = place || ctx.text;
        else if (ctx.id.startsWith("district")) district = district || ctx.text;
      }
    }

    // Some features include these at top level
    if (!neighborhood && feature.properties?.neighborhood) {
      neighborhood = feature.properties.neighborhood;
    }

    return NextResponse.json({
      success: true,
      formatted: feature.place_name,
      latitude,
      longitude,
      neighborhood,
      locality,
      place,
      district,
      raw: dataObj,
    });
  } catch (error) {
    console.error("Mapbox geocoding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
