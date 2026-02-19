/**
 * Image generation is disabled (Groq is text-only).
 * Returns imageUrl: null so existing UI does not break.
 */

export async function POST(request: Request) {
  try {
    await request.json();
    return new Response(
      JSON.stringify({
        imageUrl: null,
        error: "Image generation is disabled. This app uses Groq for text only.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ imageUrl: null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
