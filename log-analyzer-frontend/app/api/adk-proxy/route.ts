import { type NextRequest, NextResponse } from "next/server"

const ADK_API_URL = process.env.NEXT_PUBLIC_ADK_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const { action, userId, sessionId, searchParams } = await request.json()

    if (action === "createSession") {
      const response = await fetch(`${ADK_API_URL}/apps/root_agent/users/${userId}/sessions/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: {
            initialized: true,
            timestamp: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: errorText }, { status: response.status })
      }

      const sessionData = await response.json()
      return NextResponse.json(sessionData)
    }

    if (action === "sendQuery") {
      const response = await fetch(`${ADK_API_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appName: "root_agent",
          userId: userId,
          sessionId: sessionId,
          newMessage: {
            role: "user",
            parts: [
              {
                text: JSON.stringify(searchParams),
              },
            ],
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: errorText }, { status: response.status })
      }

      const events = await response.json()
      return NextResponse.json(events)
    }

    if (action === "deleteSession") {
      const response = await fetch(`${ADK_API_URL}/apps/root_agent/users/${userId}/sessions/${sessionId}`, {
        method: "DELETE",
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("ADK Proxy error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
