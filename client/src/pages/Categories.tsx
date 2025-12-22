import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Edit as EditIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import * as categoriesApi from '../services/categories';
import EditCategoryDialog from '../components/Categories/EditCategoryDialog';
import { useNavigate } from 'react-router-dom';

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoriesApi.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: any) => {
    setSelectedCategory(category);
    setEditOpen(true);
  };

  const handleShowTransactions = (categoryId: string) => {
    navigate(`/transactions?categories=${encodeURIComponent(categoryId)}`);
  };

  const handleSave = async () => {
    if (!selectedCategory) return;
    try {
      if (!selectedCategory.id) {
        // create new
        await categoriesApi.createCategory(selectedCategory.name, selectedCategory.keywords || []);
      } else {
        await categoriesApi.updateCategory(selectedCategory.id, {
          name: selectedCategory.name,
          keywords: selectedCategory.keywords,
        });
      }
      await fetchCategories();
    } catch (err: any) {
      // ignore; fetch will show latest
    }
  };

  const handleDeleteClick = (category: any) => {
    setCategoryToDelete(category);
    setDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await categoriesApi.deleteCategory(categoryToDelete.id);
      setDeleteOpen(false);
      setCategoryToDelete(null);
      await fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete category');
      setDeleteOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={600}>
          Categories
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedCategory({ id: '', name: '', keywords: [] });
            setEditOpen(true);
          }}
        >
          Add Category
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Keywords</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{(c.keywords || []).join(', ')}</TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleEdit(c)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(c)} color="error">
                        <DeleteIcon />
                      </IconButton>
                      <Button size="small" onClick={() => handleShowTransactions(c.id)} sx={{ ml: 1 }}>
                        Show Transactions
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditCategoryDialog
        open={editOpen}
        category={selectedCategory}
        onClose={() => {
          setEditOpen(false);
          setSelectedCategory(null);
        }}
        onSaved={async () => { await handleSave() }}
      />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the category <strong>{categoryToDelete?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Categories;
