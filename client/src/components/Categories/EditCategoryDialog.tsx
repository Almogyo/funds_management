import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Box,
} from '@mui/material';

interface Props {
  open: boolean;
  category: { id: string; name: string; keywords: string[] } | null;
  onClose: () => void;
  onSaved: () => void;
  onShowTransactions?: (categoryId: string) => void;
}

export const EditCategoryDialog: React.FC<Props> = ({ open, category, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setKeywords(category.keywords || []);
    } else {
      setName('');
      setKeywords([]);
    }
  }, [category]);

  const addKeyword = () => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords((k) => [...k, val]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (k: string) => {
    setKeywords((arr) => arr.filter((x) => x !== k));
  };

  const handleSave = async () => {
    if (!category) return;
    try {
      (category as any).name = name;
      (category as any).keywords = keywords;
      onSaved();
    } finally {
      onClose();
    }
  };

  const title = category && category.id ? 'Edit Category' : 'Add Category';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          margin="normal"
          sx={{ mb: 2 }}
        />

        <Box sx={{ mb: 1 }}>
          <TextField
            label="Add keyword"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addKeyword();
              }
            }}
            size="small"
            sx={{ mr: 1 }}
          />
          <Button size="small" onClick={addKeyword} variant="outlined">
            Add
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {keywords.map((k) => (
            <Chip key={k} label={k} onDelete={() => removeKeyword(k)} />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditCategoryDialog;
