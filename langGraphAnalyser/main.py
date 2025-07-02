from langgraph.graph import StateGraph
#from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from analysis_node import analyze_json
from dotenv import load_dotenv
import json
import os

load_dotenv()

from typing import TypedDict

class State(TypedDict):
    json_data: dict
    analysis: str


with open("/Users/lgoel/Documents/asdfghj/webex_js_sdk_logs.json", "r") as f:
    input_json = json.load(f)

initial_state = {
    "json_data": input_json,
    "analysis": None
}


llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, google_api_key=os.getenv("GOOGLE_API_KEY"))

def analyze_node(state):
    json_data = state["json_data"]
    analysis = analyze_json(json_data, llm)
    return {"json_data": json_data, "analysis": analysis}

builder = StateGraph(State)
builder.add_node("analyze", analyze_node)
builder.set_entry_point("analyze")
builder.set_finish_point("analyze")

graph = builder.compile()
final_state = graph.invoke(initial_state)

print("=== Analysis Result ===")
print(final_state["analysis"])
