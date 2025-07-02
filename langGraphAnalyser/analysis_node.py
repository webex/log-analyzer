from langchain.schema import HumanMessage, SystemMessage

def analyze_json(json_data, llm):
    system_prompt = "Analyze the following JSON data and provide insights. Provide temporal analysis highlighting different endpoints and segregation of microservices. If any errors are present in the logs, provide its detailed analysis."
    human_prompt = f"Here is the JSON:\n```json\n{json_data}\n```"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=human_prompt)
    ]

    response = llm.invoke(messages)
    return response.content
