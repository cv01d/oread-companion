#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import faissNode from 'faiss-node';
const { IndexFlatL2 } = faissNode;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTOR_STORE_DIR = path.join(__dirname, '..', 'data', 'vector-store');

// In-memory cache of loaded indexes
const indexCache = new Map();

class VectorStoreServer {
  constructor() {
    this.server = new Server({
      name: 'vector-store-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'add_vectors',
          description: 'Add document vectors to session index',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session ID'
              },
              documents: {
                type: 'array',
                description: 'Array of documents with text and metadata',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    metadata: { type: 'object' }
                  }
                }
              },
              vectors: {
                type: 'array',
                description: 'Array of embedding vectors',
                items: {
                  type: 'array',
                  items: { type: 'number' }
                }
              }
            },
            required: ['session_id', 'documents', 'vectors']
          }
        },
        {
          name: 'semantic_search',
          description: 'Search for similar documents using vector similarity',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session ID'
              },
              query_vector: {
                type: 'array',
                description: 'Query embedding vector',
                items: { type: 'number' }
              },
              top_k: {
                type: 'number',
                description: 'Number of results to return',
                default: 5
              }
            },
            required: ['session_id', 'query_vector']
          }
        },
        {
          name: 'get_index_stats',
          description: 'Get statistics about vector index',
          inputSchema: {
            type: 'object',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session ID'
              }
            },
            required: ['session_id']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'add_vectors':
            return await this.addVectors(args);
          case 'semantic_search':
            return await this.semanticSearch(args);
          case 'get_index_stats':
            return await this.getIndexStats(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: error.message })
          }]
        };
      }
    });
  }

  async addVectors(args) {
    const { session_id, documents, vectors } = args;

    // Ensure vector store directory exists
    await fs.mkdir(VECTOR_STORE_DIR, { recursive: true });

    const indexPath = path.join(VECTOR_STORE_DIR, `${session_id}.index`);
    const metaPath = path.join(VECTOR_STORE_DIR, `${session_id}.meta.json`);

    let index;
    let metadata = { documents: [], dimension: vectors[0].length };

    try {
      // Try to load existing index
      const indexData = await fs.readFile(indexPath);
      const metaData = await fs.readFile(metaPath, 'utf8');
      metadata = JSON.parse(metaData);

      // Load FAISS index from buffer
      index = IndexFlatL2.read(indexData);

    } catch (error) {
      // Create new index
      const dimension = vectors[0].length;
      index = new IndexFlatL2(dimension);
      metadata.dimension = dimension;
    }

    // Add vectors to index
    const vectorArray = Float32Array.from(vectors.flat());
    index.add(vectorArray);

    // Add document metadata
    documents.forEach((doc, idx) => {
      metadata.documents.push({
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        vector_index: metadata.documents.length + idx
      });
    });

    // Save index
    const indexBuffer = index.write();
    await fs.writeFile(indexPath, indexBuffer);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    // Cache the index
    indexCache.set(session_id, { index, metadata });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          added: documents.length,
          total: metadata.documents.length
        })
      }]
    };
  }

  async semanticSearch(args) {
    const { session_id, query_vector, top_k = 5 } = args;

    const indexPath = path.join(VECTOR_STORE_DIR, `${session_id}.index`);
    const metaPath = path.join(VECTOR_STORE_DIR, `${session_id}.meta.json`);

    let index, metadata;

    // Check cache first
    if (indexCache.has(session_id)) {
      ({ index, metadata } = indexCache.get(session_id));
    } else {
      // Load from disk
      const indexData = await fs.readFile(indexPath);
      const metaData = await fs.readFile(metaPath, 'utf8');
      metadata = JSON.parse(metaData);
      index = IndexFlatL2.read(indexData);

      // Cache it
      indexCache.set(session_id, { index, metadata });
    }

    // Search
    const queryArray = Float32Array.from(query_vector);
    const k = Math.min(top_k, metadata.documents.length);
    const { distances, labels } = index.search(queryArray, k);

    // Build results
    const results = [];
    for (let i = 0; i < k; i++) {
      const docIndex = labels[i];
      const doc = metadata.documents[docIndex];
      if (doc) {
        results.push({
          ...doc,
          similarity: 1 / (1 + distances[i])  // Convert distance to similarity score
        });
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results
        })
      }]
    };
  }

  async getIndexStats(args) {
    const { session_id } = args;

    const metaPath = path.join(VECTOR_STORE_DIR, `${session_id}.meta.json`);

    try {
      const metaData = await fs.readFile(metaPath, 'utf8');
      const metadata = JSON.parse(metaData);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            session_id,
            document_count: metadata.documents.length,
            dimension: metadata.dimension
          })
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Index not found',
            session_id,
            document_count: 0
          })
        }]
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Vector Store MCP server running');
  }
}

// Start server
const server = new VectorStoreServer();
server.start().catch(console.error);
