"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { api } from "@/lib/api"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const { token } = await api.login(email, password)
      localStorage.setItem("qr-token", token)
      router.push("/home")
    } catch {
      setError("Usuario o contraseña incorrectos")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0d0d12] relative overflow-hidden">
      {/* Grid background */}
      <div className="grid-background" />
      
      {/* Subtle purple glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
      
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/logo.png"
            alt="Interaktive Logo"
            width={80}
            height={80}
            className="mb-4"
          />
          <h1 className="text-2xl font-semibold text-white">
            Interaktive QR Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#151520] border border-[#2a2a3c] rounded-lg p-6 space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ingresa tu email"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-3 pl-10 pr-4 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3c] rounded-md py-3 pl-10 pr-12 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-md">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Ingresando..." : "Ingresar"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-6">
          © 2026 Interaktive Solutions
        </p>
      </div>
    </main>
  )
}
