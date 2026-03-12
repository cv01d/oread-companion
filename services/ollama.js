import { Ollama } from 'ollama';

class OllamaService {
  constructor() {
    this.ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
  }

  async checkHealth() {
    try {
      await this.ollama.list();
      return { status: 'ok', message: 'Ollama service is running' };
    } catch (error) {
      return {
        status: 'error',
        message: 'Ollama service is not available. Make sure Ollama is running.',
        error: error.message
      };
    }
  }

  async listModels() {
    try {
      const response = await this.ollama.list();
      return {
        success: true,
        models: response.models || []
      };
    } catch (error) {
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  async pullModel(modelName) {
    try {
      const stream = await this.ollama.pull({
        model: modelName,
        stream: true
      });
      return stream;
    } catch (error) {
      throw new Error(`Failed to pull model: ${error.message}`);
    }
  }

  async chat(model, messages, options = {}) {
    try {
      // Build chat request with optional parameters
      const chatRequest = {
        model,
        messages,
        stream: true
      };

      // Add system prompt if provided
      if (options.systemPrompt) {
        // Prepend system message to conversation
        chatRequest.messages = [
          { role: 'system', content: options.systemPrompt },
          ...messages
        ];
      }

      // Add generation options if provided
      if (options.temperature !== undefined || options.topP !== undefined || options.maxTokens !== undefined) {
        chatRequest.options = {};

        if (options.temperature !== undefined) {
          chatRequest.options.temperature = options.temperature;
        }
        if (options.topP !== undefined) {
          chatRequest.options.top_p = options.topP;
        }
        if (options.maxTokens !== undefined) {
          chatRequest.options.num_predict = options.maxTokens;
        }
      }

      const response = await this.ollama.chat(chatRequest);
      return response;
    } catch (error) {
      throw new Error(`Chat failed: ${error.message}`);
    }
  }
}

export default new OllamaService();
