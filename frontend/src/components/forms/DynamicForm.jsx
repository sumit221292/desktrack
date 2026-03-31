import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * Premium Dynamic Form Renderer
 * Renders a form based on custom field definitions with high-end UI/UX.
 */
const DynamicForm = ({ fields, initialValues = {}, onSubmit, isLoading, onCancel }) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const handleChange = (id, value) => {
    setValues(prev => ({ ...prev, [id]: value }));
    // Clear error when user types
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    let isValid = true;
    fields.forEach(f => {
      if (f.is_required && !values[f.id]) {
        newErrors[f.id] = 'This field is required';
        isValid = false;
      }
    });
    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(values);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col space-y-1.5 min-h-[85px]">
            <label className="text-[13px] font-bold text-slate-700 tracking-wide uppercase">
              {field.field_name}
              {field.is_required && <span className="text-alert-500 ml-1 font-normal">*</span>}
            </label>
            
            {field.field_type === 'text' && (
              <Input
                type="text"
                placeholder={`Enter ${field.field_name.toLowerCase()}`}
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                error={errors[field.id]}
              />
            )}

            {field.field_type === 'number' && (
              <Input
                type="number"
                placeholder="0"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                error={errors[field.id]}
              />
            )}

            {field.field_type === 'dropdown' && (
              <div className="w-full">
                <select
                  value={values[field.id] || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800 ${errors[field.id] ? 'border-alert-500 focus:border-alert-500 bg-alert-50/50' : 'border-slate-200'}`}
                >
                  <option value="" disabled className="text-slate-400">Select an option...</option>
                  {field.options?.map((opt, i) => (
                    <option key={i} value={typeof opt === 'object' ? opt.value : opt}>
                      {typeof opt === 'object' ? opt.label : opt}
                    </option>
                  ))}
                </select>
                {errors[field.id] && <p className="mt-1.5 text-xs font-medium text-alert-500 px-1">{errors[field.id]}</p>}
              </div>
            )}

            {field.field_type === 'date' && (
              <Input
                type="date"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                error={errors[field.id]}
              />
            )}

            {field.field_type === 'boolean' && (
              <label className="flex items-center gap-3 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={values[field.id] === true || values[field.id] === 'true'}
                  onChange={(e) => handleChange(field.id, e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500/20"
                />
                <span className="text-sm font-medium text-slate-600">Yes</span>
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end items-center space-x-3 pt-8 mt-4 border-t border-slate-100">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto min-w-[120px]"
        >
          {isLoading ? 'Processing...' : 'Save Employee'}
        </Button>
      </div>
    </form>
  );
};

export default DynamicForm;
