'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorNotif, setErrorNotif] = useState('')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  
  const [showSettingPopup, setShowSettingPopup] = useState(false)
  const [settingPassword, setSettingPassword] = useState('')
  const [settingError, setSettingError] = useState('')
  
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorNotif('')

    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single()

    if (error || !data) {
      setErrorNotif('Password atau Username salah!')
      return
    }

    localStorage.setItem('user_session', JSON.stringify(data))
    router.push('/menu')
  }

  const handleWebSettingLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setSettingError('')
    if (settingPassword === '9909') {
      router.push('/setting') 
    } else {
      setSettingError('Password Setting Salah!')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0 bg-[#0d47a1] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-90" />

      <div className="absolute top-4 right-4 z-20">
        <button 
          onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition text-white"
        >
          <Settings size={24} />
        </button>

        {showSettingsMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 text-gray-800 z-30">
            <button 
              onClick={() => {
                setShowSettingsMenu(false)
                setShowSettingPopup(true)
              }}
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 font-medium"
            >
              Web Setting
            </button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100">Ganti Theme</button>
            <button className="block w-full text-left px-4 py-2 hover:bg-gray-100">Ganti Background</button>
          </div>
        )}
      </div>

      {showSettingPopup && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[90%] max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-black">Masukkan Password Creator</h3>
            {settingError && <p className="text-red-500 text-sm mb-3">{settingError}</p>}
            <form onSubmit={handleWebSettingLogin}>
              <input 
                type="password"
                className="w-full p-2 border border-gray-300 rounded mb-4 text-black outline-none focus:border-blue-500"
                placeholder="Password Setting..."
                value={settingPassword}
                onChange={(e) => setSettingPassword(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowSettingPopup(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Masuk</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="relative z-10 bg-white/95 p-8 rounded-xl shadow-2xl w-[90%] max-w-md">
        <div className="flex justify-center mb-6">
          <img src="/sunpevece.png" alt="Logo Sunpevece" className="h-16 object-contain" />
        </div>
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Silahkan Login</h2>

        {errorNotif && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-md text-center font-semibold animate-pulse">
            {errorNotif}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input type="text" className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-black" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-black" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition duration-200 mt-2">LOGIN</button>
        </form>
      </div>
    </div>
  )
}
