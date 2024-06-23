import json
import os

import boto3
from aws_lambda_powertools import Logger
from langchain.chains import ConversationalRetrievalChain
from langchain.embeddings import BedrockEmbeddings
from langchain.llms.bedrock import Bedrock
from langchain.memory import ConversationBufferMemory
from langchain.memory.chat_message_histories import DynamoDBChatMessageHistory
from langchain.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate  # Import the module

MEMORY_TABLE = os.environ["MEMORY_TABLE"]
BUCKET = os.environ["BUCKET"]

s3 = boto3.client("s3")
logger = Logger()

@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    try:
        event_body = json.loads(event["body"])
        file_name = event_body["fileName"]
        human_input = event_body["prompt"]
        conversation_id = event["pathParameters"]["conversationid"]

        user = event["requestContext"]["authorizer"]["claims"]["sub"]

        s3.download_file(BUCKET, f"{user}/{file_name}/index.faiss", "/tmp/index.faiss")
        s3.download_file(BUCKET, f"{user}/{file_name}/index.pkl", "/tmp/index.pkl")

        bedrock_runtime = boto3.client(
            service_name="bedrock-runtime",
            region_name="us-east-1",
        )

        embeddings, llm = BedrockEmbeddings(
            model_id="amazon.titan-embed-text-v1",
            client=bedrock_runtime,
            region_name="us-east-1",
        ), Bedrock(
            model_id="anthropic.claude-v2:1", client=bedrock_runtime, region_name="us-east-1"
        )

        # Allow dangerous deserialization
        faiss_index = FAISS.load_local("/tmp", embeddings, allow_dangerous_deserialization=True)

        message_history = DynamoDBChatMessageHistory(
            table_name=MEMORY_TABLE, session_id=conversation_id
        )

        memory = ConversationBufferMemory(
            memory_key="chat_history",
            chat_memory=message_history,
            input_key="question",
            output_key="answer",
            return_messages=True,
        )

        # prompt_template = ChatPromptTemplate.from_messages([
        #     ("system", "You are a helpful assistant"),
        #     ("system", "You will not respond in any other language than English and Bahasa Melayu"),
        #     ("system", "If I asked in English answer in English"),
        #     ("system", "If I asked in Bahasa Melayu or Bahasa Indonesia answer in Bahasa Melayu"),
        #     ("system", "You will provide answers based on embedding context"),
        #     ("system", "You will not say sorry or maaf"),
        #     ("system", "You will not yap in your answer"),
        #     ("system", "You will respond in simplest form. It's important"),
        #     ("system", "If I asked outside of the context, tell me to ask based on context provided in a simplest manner"),
        #     ("user", "Tell me about {topic}")
        # ])

        prompt_template = ChatPromptTemplate.from_messages([
            ("system", "You are a helpful assistant specialized in providing information from a user manual for a complaint system."),
            ("system", "You will respond only in English or Bahasa Melayu."),
            ("system", "If a question is asked in English, answer in English."),
            ("system", "If a question is asked in Bahasa Melayu or Bahasa Indonesia, answer in Bahasa Melayu."),
            ("system", "You will provide answers based on the context provided from the user manual."),
            ("system", "You will not apologize ('sorry' or 'maaf') in your responses."),
            ("system", "You will not include unnecessary information in your answers."),
            ("system", "You will respond in the simplest form possible."),
            ("system", "If a question is outside the context of the user manual, inform the user to ask based on the context provided in the simplest manner."),
            ("system", "Maintain a polite and professional tone in all responses."),
            ("system", "If a query is unclear, ask the user for clarification."),
            ("system", "Use examples from the user manual when appropriate to illustrate points."),
            ("system", "If a user repeats a query or asks a follow-up question, provide consistent information."),
            ("system", "If the user manual content is missing or incomplete, inform the user that the information is not available."),
            ("user", "Please provide information on {topic}")
        ])


        formatted_prompt = prompt_template.format(topic=human_input)

        if isinstance(formatted_prompt, ChatPromptTemplate):
            formatted_prompt_str = formatted_prompt.to_string()
        else:
            formatted_prompt_str = str(formatted_prompt)

        qa = ConversationalRetrievalChain.from_llm(
            llm=llm,
            retriever=faiss_index.as_retriever(),
            memory=memory,
            return_source_documents=True,
            verbose=True,
        )

        res = qa({"question": formatted_prompt_str})

        logger.info(res)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps(res["answer"]),
        }
    except Exception as e:
        logger.error(e)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps({"error": str(e)}),
        }
