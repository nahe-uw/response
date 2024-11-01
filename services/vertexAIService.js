import { initializeVertexAI } from '../config/vertexAI';

export async function generateEmbeddings(text, prismaUser) {
  try {
    const { vertexAI } = await initializeVertexAI(prismaUser);

    const model = vertexAI.preview.getModel('textembedding-gecko@latest');

    const result = await model.predict({
      instances: [{ content: text }]
    });

    return result.predictions[0].embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

export async function updateVectorSearchIndex(knowledgeId, embeddings, prismaUser) {
  try {
    const { vertexAI } = await initializeVertexAI(prismaUser);

    const indexEndpoint = vertexAI.preview.indexEndpoint({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: 'us-central1',
      indexEndpointId: process.env.VERTEX_AI_INDEX_ENDPOINT_ID
    });

    await indexEndpoint.upsertDatapoints({
      datapoints: [{
        datapointId: `knowledge_${knowledgeId}`,
        featureVector: embeddings
      }]
    });

    return true;
  } catch (error) {
    console.error('Error updating vector search index:', error);
    throw error;
  }
} 