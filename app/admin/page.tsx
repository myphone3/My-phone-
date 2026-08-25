'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminPage() {
  const [products, setProducts] = useState<any[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*')
    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data || [])
    }
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !price) {
      alert('נא למלא שם ומחיר')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('products').insert([{ name, price: Number(price) }])
    setLoading(false)

    if (error) {
      alert('שגיאה בשמירה: ' + error.message)
    } else {
      setMessage('המוצר נוסף בהצלחה!')
      setName('')
      setPrice('')
      fetchProducts()
    }
  }

  return (
    <div style={{ padding: '20px', direction: 'rtl', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h1>ניהול מוצרים - My Phone</h1>
      
      <form onSubmit={handleAddProduct} style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ddd' }}>
        <h3>הוספת מכשיר חדש</h3>
        {message && <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>שם המכשיר:</label>
          <input 
            type="text" 
            placeholder="למשל: iPhone 15" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>מחיר:</label>
          <input 
            type="number" 
            placeholder="למשל: 3500" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)}
            style={{ padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          style={{ background: '#000', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '5px', width: '100%', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? 'שומר...' : 'שמור מוצר במסד הנתונים'}
        </button>
      </form>

      <h2>רשימת המכשירים הקיימים</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {products.map((p, index) => (
          <li key={index} style={{ background: '#fff', padding: '10px 15px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <span><b>{p.name}</b></span>
            <span style={{ color: '#666' }}>₪{p.price}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
