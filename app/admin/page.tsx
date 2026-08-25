'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  return (
    <div style={{ padding: '20px', direction: 'rtl', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h1>ניהול מוצרים - כשרפון</h1>
      <div style={{ background: '#f4f4f4', padding: '20px', borderRadius: '8px', marginTop: '20px' }}>
        <h3>הוספת מכשיר חדש</h3>
        <input 
          type="text" 
          placeholder="שם המכשיר" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', boxSizing: 'border-box' }}
        />
        <input 
          type="text" 
          placeholder="מחיר" 
          value={price} 
          onChange={(e) => setPrice(e.target.value)}
          style={{ display: 'block', margin: '10px 0', padding: '10px', width: '100%', boxSizing: 'border-box' }}
        />
        <button 
          style={{ background: '#000', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '5px', width: '100%', fontWeight: 'bold' }}
          onClick={() => alert('השדות נקלטו בהצלחה!')}
        >
          שמור מוצר
        </button>
      </div>
    </div>
  )
}
