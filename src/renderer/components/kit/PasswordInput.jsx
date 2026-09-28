import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { TextInput } from './Field';
import { IconButton } from './Button';

// TextInput with a show/hide eye button. Works inside <Field> like TextInput
// (id / aria-* props land on the <input>). Layout keys in `style` go on the
// wrapper, the rest on the input.
export function PasswordInput({ style = {}, ...props }) {
  const [visible, setVisible] = useState(false);
  const { width, flex, margin, marginTop, marginBottom, ...inputStyle } = style;
  return (
    <div style={{ position: 'relative', width: width || '100%', flex, margin, marginTop, marginBottom }}>
      <TextInput
        autoComplete="current-password"
        {...props}
        type={visible ? 'text' : 'password'}
        style={{ paddingRight: '40px', ...inputStyle }}
      />
      <IconButton
        icon={visible ? EyeOff : Eye}
        label={visible ? 'Hide password' : 'Show password'}
        size="sm"
        disabled={props.disabled}
        onClick={() => setVisible((v) => !v)}
        style={{ position: 'absolute', right: '4px', top: '50%', marginTop: '-14px' }}
      />
    </div>
  );
}
