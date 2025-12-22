import { apiClient } from './api';

export async function getCategories() {
  return apiClient.getCategories();
}

export async function createCategory(name: string, keywords: string[] = []) {
  const response = await (apiClient as any).client.post('/api/categories', { name, keywords });
  return response.data.category;
}

export async function updateCategory(id: string, updates: { name?: string; keywords?: string[] }) {
  const response = await (apiClient as any).client.put(`/api/categories/${id}`, updates);
  return response.data;
}

export async function deleteCategory(id: string) {
  const response = await (apiClient as any).client.delete(`/api/categories/${id}`);
  return response.data;
}

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
