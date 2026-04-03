import { END, StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./state/State";
import { llm } from "./Modal/llm";
import { HumanMessage, type AIMessage } from "@langchain/core/messages";
import { createLinkdinAgentPrompt, criticPrompt } from "./prompt/prompt";
import * as readline from 'readline';
async function createLinkdinAgent(state:typeof StateAnnotation.State ) {
  
  const response= await llm.invoke([{
    role: "system",
    content: createLinkdinAgentPrompt
  },...state.messages])
    return {
        messages:[response],
        repeatCount: state.repeatCount ? state.repeatCount + 1 : 1
    }
}
async function criticLinkedinAgent(state:typeof StateAnnotation.State ) {
 
 const lastMessage=[...state.messages].reverse().find(msg=>msg.getType() === 'ai')
  const response = await llm.invoke([{
     role: "system",
     content: criticPrompt
  },lastMessage as AIMessage])
    
  return {
    messages:[new HumanMessage(response.content)],
    repeatCount: state.repeatCount ? state.repeatCount + 1 : 1
  }
}

function whereShouldIGoNext(state:typeof StateAnnotation.State ) {
    if (state.repeatCount >= 4) {
         return "__end__"; 
    }
     return "criticLinkedinAgent";
   
}
/**creating custom graph */
const graph = new StateGraph(StateAnnotation)
.addNode("createLinkedinAgent", createLinkdinAgent)
.addNode("criticLinkedinAgent", criticLinkedinAgent)
.addEdge("__start__","createLinkedinAgent")
.addConditionalEdges("createLinkedinAgent",whereShouldIGoNext,{
    criticLinkedinAgent: "criticLinkedinAgent",
    __end__: END
})
.addEdge("criticLinkedinAgent","createLinkedinAgent")
.compile()


async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
  }

  let running = true;
  while (running) {
    const input = await askQuestion('Enter your message (type "bye" to exit): ');
    if (input.toLowerCase() === 'bye') {
      running = false;
    } else {
      const res = await graph.invoke({ messages: [{ role: "user", content: input }] });
      console.log("Final Response:", res.messages[res.messages.length-1]?.content);
    }
  }
  rl.close();
}
main();