import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Autocomplete,
  TextField,
  Button,
  Typography,
  Chip,
} from '@mui/material';

interface TransactionCategoryDialogProps {
  open: boolean;
  transaction: { id: string; description: string; category: string | null } | null;
  categories: Array<{ id: string; name: string; keywords: string[] }>;
  onClose: () => void;
  onAssignExisting: (transactionId: string, categoryId: string) => Promise<void>;
  onCreateAndAssign: (
    transactionId: string,
    categoryName: string,
    keyword: string
  ) => Promise<void>;
}

export const TransactionCategoryDialog: React.FC<TransactionCategoryDialogProps> = ({
  open,
  transaction,
  categories,
  onClose,
  onAssignExisting,
  onCreateAndAssign,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAssignExisting = async () => {
    if (!selectedCategory || !transaction) return;
    setLoading(true);
    try {
      await onAssignExisting(transaction.id, selectedCategory.id);
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async () => {
    if (!newCategoryName || !transaction) return;
    setLoading(true);
    try {
      await onCreateAndAssign(
        transaction.id,
        newCategoryName,
        transaction.description
      );
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory(null);
    setCreateMode(false);
    setNewCategoryName('');
    onClose();
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign Category to Transaction</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          <strong>Transaction:</strong> {transaction.description}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          <strong>Current Category:</strong>{' '}
          <Chip label={transaction.category || 'Unknown'} size="small" />
        </Typography>

        {!createMode ? (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Choose Existing Category
            </Typography>
            <Autocomplete
              options={categories}
              getOptionLabel={(c) => c.name}
              value={selectedCategory}
              onChange={(_e, value) => setSelectedCategory(value)}
              renderInput={(params) => (
                <TextField {...params} label="Select a category" size="small" />
              )}
            />
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Or
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setCreateMode(true)}
              >
                Create New Category
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Create New Category
            </Typography>
            <TextField
              fullWidth
              label="Category Name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              size="small"
              margin="normal"
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              This will create a new category with "{transaction.description}"
              as a keyword.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setCreateMode(false);
                  setNewCategoryName('');
                }}
              >
                Back to Select
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {!createMode ? (
          <Button
            onClick={handleAssignExisting}
            disabled={!selectedCategory || loading}
            color="primary"
            variant="contained"
          >
            {loading ? 'Assigning...' : 'Assign'}
          </Button>
        ) : (
          <Button
            onClick={handleCreateAndAssign}
            disabled={!newCategoryName || loading}
            color="primary"
            variant="contained"
          >
            {loading ? 'Creating...' : 'Create & Assign'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TransactionCategoryDialog;
