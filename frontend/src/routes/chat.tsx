import { API } from "aws-amplify";
import React, { KeyboardEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingGrid from "../../public/loading-grid.svg";
import { Conversation } from "../common/types";
import ChatMessages from "../components/ChatMessages";
// import ChatSidebar from "../components/ChatSidebar";

const Document: React.FC = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState<string>("idle");
  const [messageStatus, setMessageStatus] = useState<string>("idle");
  const [conversationListStatus, setConversationListStatus] = useState<
    "idle" | "loading"
  >("idle");
  const [prompt, setPrompt] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(false); // State for chat visibility

  const fetchData = async (conversationid = params.conversationid) => {
    setLoading("loading");
    const conversation = await API.get(
      "serverless-pdf-chat",
      `/doc/${params.documentid}/${conversationid}`,
      {}
    );

    // conversation.messages = [
    //   {
    //     type: "ai",
    //     data: {
    //       type: "ai",
    //       content: "Hello there! 👋🏻 How can I assist you today?",
    //     },
    //   },
    //   {
    //     type: "ai",
    //     data: {
    //       type: "ai",
    //       content: "Ask me anything, I'm here to help with your questions! 😁",
    //     },
    //   },
    //   {
    //     type: "ai",
    //     data: {
    //       type: "ai",
    //       content: "Tip: You may also ask in Bahasa.",
    //     },
    //   },
    // ];

    setConversation(conversation);

    setLoading("idle");
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePromptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(event.target.value);
  };

  const addConversation = async () => {
    setConversationListStatus("loading");
    const newConversation = await API.post(
      "serverless-pdf-chat",
      `/doc/${params.documentid}`,
      {}
    );
    fetchData(newConversation.conversationid);
    navigate(`/doc/${params.documentid}/${newConversation.conversationid}`);
    setConversationListStatus("idle");
  };

  // const switchConversation = (e: React.MouseEvent<HTMLButtonElement>) => {
  //   const targetButton = e.target as HTMLButtonElement;
  //   navigate(`/doc/${params.documentid}/${targetButton.id}`);
  //   fetchData(targetButton.id);
  // };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key == "Enter") {
      submitMessage();
    }
  };

  const submitMessage = async () => {
    setMessageStatus("loading");

    if (conversation !== null) {
      const previewMessage = {
        type: "text",
        data: {
          content: prompt,
          additional_kwargs: {},
          example: false,
        },
      };

      const updatedConversation = {
        ...conversation,
        messages: [...conversation.messages, previewMessage],
      };

      setConversation(updatedConversation);
    }

    await API.post(
      "serverless-pdf-chat",
      `/${conversation?.document.documentid}/${conversation?.conversationid}`,
      {
        body: {
          fileName: conversation?.document.filename,
          prompt: prompt,
        },
      }
    );
    setPrompt("");
    fetchData(conversation?.conversationid);
    setMessageStatus("idle");
  };

  const toggleChatVisibility = () => {
    if (!isChatVisible) addConversation();
    setIsChatVisible((prev) => !prev);
  };

  return (
    <div className="relative">
      {loading === "loading" && !conversation && (
        <div className="flex flex-col items-center mt-6">
          <img src={LoadingGrid} width={40} />
        </div>
      )}
      <div>
        <h1 className="font-bold text-lg mb-4">
          Incididunt velit enim labore occaecat culpa proident elit laborum
          irure in laborum labore non.
        </h1>
        <p>
          Dolore eiusmod anim anim quis tempor elit et cillum amet deserunt
          occaecat. Excepteur laboris sit anim velit cupidatat est esse occaecat
          aliqua non et quis. Occaecat voluptate voluptate fugiat esse
          exercitation irure. Consectetur do irure laborum qui ex deserunt
          voluptate et minim aute qui est tempor qui consectetur. Lorem occaecat
          ad consectetur esse elit minim consectetur dolor. Lorem aute non
          excepteur sit consectetur quis culpa sit in. Ullamco sint culpa in.
          Excepteur excepteur consequat quis officia commodo excepteur velit ut.
        </p>
      </div>
      <div>
        <button
          onClick={toggleChatVisibility}
          className="rounded-full p-3 fixed bottom-10 right-10 text-white bg-orange-600 shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 z-20"
        >
          <svg
            width={28}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.337 21.718a6.707 6.707 0 0 1-.533-.074.75.75 0 0 1-.44-1.223 3.73 3.73 0 0 0 .814-1.686c.023-.115-.022-.317-.254-.543C3.274 16.587 2.25 14.41 2.25 12c0-5.03 4.428-9 9.75-9s9.75 3.97 9.75 9c0 5.03-4.428 9-9.75 9-.833 0-1.643-.097-2.417-.279a6.721 6.721 0 0 1-4.246.997Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {isChatVisible && conversation && (
        <div className="fixed bottom-10 right-28 height-[200px] overflow-auto sm:w-3/4 md:w-1/2 lg:w-1/3 border border-gray-200 rounded-lg z-10 bg-white p-4 shadow-lg">
          {/* <ChatSidebar
            conversation={conversation}
            params={params}
            addConversation={addConversation}
            switchConversation={switchConversation}
            conversationListStatus={conversationListStatus}
          /> */}
          <ChatMessages
            prompt={prompt}
            conversation={conversation}
            messageStatus={messageStatus}
            submitMessage={submitMessage}
            handleKeyPress={handleKeyPress}
            handlePromptChange={handlePromptChange}
          />
        </div>
      )}
    </div>
  );
};

export default Document;
