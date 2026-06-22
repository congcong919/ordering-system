import { useState } from 'react';
import {
  useMenu,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
} from '../hooks/useMenu';
import { MenuItem } from '../types';

interface MenuForm {
  name: string;
  price: string;
  category: string;
  description: string;
  available: boolean;
  imageUrl: string;
}

type StringMenuFormKey = keyof Omit<MenuForm, 'available'>;

interface FormField {
  label: string;
  key: StringMenuFormKey;
  type: string;
  required?: boolean;
}

const FORM_FIELDS: FormField[] = [
  { label: 'Name',        key: 'name',        type: 'text',   required: true },
  { label: 'Price ($)',   key: 'price',        type: 'number', required: true },
  { label: 'Category',   key: 'category',     type: 'text',   required: true },
  { label: 'Description', key: 'description', type: 'text' },
  { label: 'Image URL',  key: 'imageUrl',     type: 'url' },
];

const EMPTY_FORM: MenuForm = { name: '', price: '', category: '', description: '', available: true, imageUrl: '' };

export function AdminMenuPage() {
  const { data, isLoading } = useMenu();
  const items: MenuItem[] = data ?? [];
  const { mutateAsync: createItem, isPending: creating } = useCreateMenuItem();
  const { mutateAsync: updateItem, isPending: updating } = useUpdateMenuItem();
  const { mutateAsync: deleteItem } = useDeleteMenuItem();

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MenuForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item.id);
    setForm({
      name:        item.name || '',
      price:       String(item.price || ''),
      category:    item.category || '',
      description: item.description || '',
      available:   item.available !== false,
      imageUrl:    item.imageUrl || '',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      price: parseFloat(form.price),
    };
    if (isNaN(payload.price) || payload.price <= 0) {
      setError('Price must be a positive number.');
      return;
    }
    try {
      if (editing) {
        await updateItem({ id: editing, ...payload });
      } else {
        await createItem(payload);
      }
      setShowForm(false);
    } catch {
      setError('Save failed. Please try again.');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this menu item?')) return;
    await deleteItem(id);
  }

  async function toggleAvailable(item: MenuItem) {
    await updateItem({ id: item.id, available: !item.available });
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Menu Management</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition"
        >
          + Add item
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit item' : 'New item'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

              {FORM_FIELDS.map(({ label, key, type, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    step={key === 'price' ? '0.01' : undefined}
                    min={key === 'price' ? '0.01' : undefined}
                  />
                </div>
              ))}

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm((f) => ({ ...f, available: e.target.checked }))}
                  className="accent-brand-500"
                />
                <span className="text-sm text-stone-700">Available</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="flex-1 py-2 rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {creating || updating ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Items table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-stone-400">No menu items yet. Add one above.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-stone-500">Item</th>
                <th className="text-left px-5 py-3 font-semibold text-stone-500">Category</th>
                <th className="text-left px-5 py-3 font-semibold text-stone-500">Price</th>
                <th className="text-center px-5 py-3 font-semibold text-stone-500">Available</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-stone-50/50 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-stone-900">{item.name}</p>
                    {item.description && (
                      <p className="text-stone-400 text-xs truncate max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone-600 capitalize">{item.category}</td>
                  <td className="px-5 py-3 font-medium text-stone-700">${Number(item.price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleAvailable(item)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        item.available !== false
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-stone-100 text-stone-400 hover:bg-stone-200'
                      }`}
                    >
                      {item.available !== false ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-xs text-stone-500 hover:text-stone-800 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
