const ADK_API_URL = process.env.NEXT_PUBLIC_ADK_API_URL || "http://127.0.0.1:8000"

export class SessionManager {
  private userId: string
  private sessionId: string
  private sessionCreated = false

  constructor() {
    this.userId = `u_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.sessionId = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async ensureSession(): Promise<void> {
    if (this.sessionCreated) {
      return
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes

      const response = await fetch(
        `${ADK_API_URL}/apps/root_agent/users/${this.userId}/sessions/${this.sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            initialized: true,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (response.ok) {
        this.sessionCreated = true
        console.log("Session created successfully:", { userId: this.userId, sessionId: this.sessionId })
      } else {
        const error = await response.text()
        console.error("Failed to create session:", error)
        throw new Error("Failed to create session")
      }
    } catch (error) {
      console.error("Session creation error:", error)
      throw error
    }
  }

  async sendQuery(searchParams: any): Promise<any> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 600000) // 10 minutes

      const response = await fetch(`${ADK_API_URL}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appName: "root_agent",
          userId: this.userId,
          sessionId: this.sessionId,
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

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Query failed: ${error}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  getUserId(): string {
    return this.userId
  }

  getSessionId(): string {
    return this.sessionId
  }

  async deleteSession(): Promise<void> {
    if (!this.sessionCreated) {
      return
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 seconds

      await fetch(
        `${ADK_API_URL}/apps/root_agent/users/${this.userId}/sessions/${this.sessionId}`,
        {
          method: "DELETE",
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)
      this.sessionCreated = false
    } catch (error) {
      console.error("Failed to delete session:", error)
    }
  }
}
