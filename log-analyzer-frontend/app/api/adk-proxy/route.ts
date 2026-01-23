import { type NextRequest, NextResponse } from "next/server"

const ADK_API_URL = process.env.NEXT_PUBLIC_ADK_API_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const { action, userId, sessionId, searchParams } = await request.json()

    if (action === "createSession") {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000)

      try {
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
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json({ error: errorText }, { status: response.status })
        }

        const sessionData = await response.json()
        return NextResponse.json(sessionData)
      } finally {
        clearTimeout(timeoutId)
      }
    }

    if (action === "sendQuery") {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000)

      try {
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
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          return NextResponse.json({ error: errorText }, { status: response.status })
        }

        const events = await response.json()
        return NextResponse.json(events)
      } finally {
        clearTimeout(timeoutId)
      }
    }

    if (action === "deleteSession") {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch(`${ADK_API_URL}/apps/root_agent/users/${userId}/sessions/${sessionId}`, {
          method: "DELETE",
          signal: controller.signal,
        })

        return NextResponse.json({ success: true })
      } finally {
        clearTimeout(timeoutId)
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("ADK Proxy error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
