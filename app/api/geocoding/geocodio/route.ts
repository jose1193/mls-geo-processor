import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

    const geocodioKey = process.env.GEOCODIO_API_KEY;
    if (!geocodioKey) {
      return NextResponse.json(
        { error: "Geocodio API key not configured" },
        { status: 500 }
      );
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.geocod.io/v1.7/geocode?q=${encodedAddress}&api_key=${geocodioKey}&fields=cd,stateleg,school,timezone`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage = `Geocodio API error: ${status}`;

      if (status === 401) {
        errorMessage = "Invalid Geocodio API key";
      } else if (status === 403) {
        errorMessage = "Geocodio API key does not have sufficient permissions";
      } else if (status === 429) {
        errorMessage = "Geocodio rate limit exceeded";
      }

      return NextResponse.json({
        success: false,
        error: errorMessage,
        status,
      });
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No results found",
      });
    }

    const result = data.results[0];
    const location = result.location;
    const components = result.address_components;

    // Extract neighborhood information if available
    let neighbourhood = null;

    // Check for neighborhood in formatted components
    if (components.neighborhood) {
      neighbourhood = components.neighborhood;
    } else if (components.suburb) {
      neighbourhood = components.suburb;
    }

    return NextResponse.json({
      success: true,
      formatted: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      accuracy: result.accuracy,
      accuracy_type: result.accuracy_type,
      neighbourhood,
      "House Number": components.number || null,
      street: components.street || null,
      city: components.city || null,
      county: components.county || null,
      state: components.state || null,
      zip: components.zip || null,
      source: result.source || null,
      raw: data,
    });
  } catch (error) {
    console.error("Geocodio geocoding error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
