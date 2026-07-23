"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Mail,
  Phone,
  Edit3,
  Key,
  UserX,
  UserCheck,
  Camera,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface EmployeePanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: number;
    nombreCompleto: string;
    username: string;
    dni: string;
    correo: string | null;
    telefono: string | null;
    fotoUrl: string | null;
    activo: boolean;
    creadoEn: Date;
    rol: {
      id: number;
      nombre: string;
    };
  } | null;
  isPrimaryAdmin?: boolean;
  onEdit?: (user: any) => void;
  onToggle?: (userId: number) => void;
  onChangePassword?: (userId: number) => void;
  onUploadPhoto?: (userId: number, formData: FormData) => Promise<{ success?: boolean; fotoUrl?: string; error?: string }>;
  onPhotoUpdated?: (newFotoUrl: string) => void;
}

// Role config for badge colors
const ROLE_CONFIG: Record<string, { variant: "danger" | "success" | "info" | "default"; icon: React.ReactNode }> = {
  ADMINISTRADOR: {
    variant: "danger",
    icon: <ShieldCheck size={14} />,
  },
  ENCARGADO_VENTAS: {
    variant: "success",
    icon: <Shield size={14} />,
  },
  ENCARGADO_STOCK: {
    variant: "info",
    icon: <ShieldAlert size={14} />,
  },
};

export function EmployeePanel({
  isOpen,
  onClose,
  user,
  isPrimaryAdmin = false,
  onEdit,
  onToggle,
  onChangePassword,
  onUploadPhoto,
  onPhotoUpdated,
}: EmployeePanelProps) {
  if (!user) return null;

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roleConfig = ROLE_CONFIG[user.rol.nombre] || {
    variant: "default" as const,
    icon: <Shield size={14} />,
  };

  const displayName = user.rol.nombre.replace(/_/g, " ");

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato no permitido. Solo JPG, PNG y WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB.");
      return;
    }
    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile || !onUploadPhoto) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("foto", selectedFile);
    const result = await onUploadPhoto(user.id, fd);
    if (result.error) {
      toast.error(result.error);
      setUploading(false);
      return;
    }
    if (result.fotoUrl && onPhotoUpdated) {
      onPhotoUpdated(result.fotoUrl);
    }
    setSelectedFile(null);
    setPhotoPreview(null);
    setUploading(false);
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md bg-panel border-l border-border shadow-[var(--shadow-xl)] transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-text">Detalle del Empleado</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-border"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100%-200px)]">
          {/* Large Photo */}
          <div className="flex justify-center">
            {user.fotoUrl ? (
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-brand/30 shadow-lg">
                <img
                  src={user.fotoUrl}
                  alt={user.nombreCompleto}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center text-4xl font-bold bg-brand/10 text-brand border-2 border-brand/20">
                {user.nombreCompleto.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* Cambiar fotografía button */}
          {onUploadPhoto && (
            <div className="flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/20 rounded-lg hover:bg-brand/20 transition-colors disabled:opacity-50"
              >
                <Camera size={14} />
                Cambiar fotografía
              </button>
            </div>
          )}

          {/* Photo preview */}
          {photoPreview && (
            <div className="flex items-center justify-center gap-3">
              <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-brand/20" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUploadPhoto} disabled={uploading}>
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Confirmar
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setPhotoPreview(null); setSelectedFile(null); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* User Profile Header — NO avatar here */}
          <div className="text-center">
            <h3 className="text-xl font-bold text-text">{user.nombreCompleto}</h3>
            <p className="text-sm text-text-secondary">@{user.username}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge variant={roleConfig.variant} size="sm" className="gap-1.5">
                {roleConfig.icon}
                {displayName}
              </Badge>
              <Badge variant={user.activo ? "success" : "danger"} size="sm">
                {user.activo ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Información Personal
            </h4>
            <div className="space-y-3 bg-bg p-4 rounded-[var(--radius-lg)] border border-border">
              <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                <span className="text-text-secondary flex items-center gap-2">
                  <Shield size={14} className="text-text-secondary" />
                  DNI
                </span>
                <span className="font-semibold text-text font-mono">{user.dni}</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                <span className="text-text-secondary flex items-center gap-2">
                  <Mail size={14} className="text-text-secondary" />
                  Correo Electrónico
                </span>
                <span className="font-semibold text-text">{user.correo || "-"}</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-border pb-2">
                <span className="text-text-secondary flex items-center gap-2">
                  <Phone size={14} className="text-text-secondary" />
                  Teléfono
                </span>
                <span className="font-semibold text-text">{user.telefono || "-"}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary flex items-center gap-2">
                  <Calendar size={14} className="text-text-secondary" />
                  Fecha de Registro
                </span>
                <span className="font-semibold text-text">
                  {new Date(user.creadoEn).toLocaleDateString("es-AR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Role Permissions */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Permisos del Rol
            </h4>
            <div className="bg-bg p-4 rounded-[var(--radius-lg)] border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-brand" />
                <span className="text-sm font-semibold text-text">{displayName}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* We can show some key permissions based on role */}
                {user.rol.nombre === "ADMINISTRADOR" && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Acceso completo a todos los módulos
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Gestión de usuarios y permisos
                    </div>
                  </>
                )}
                {user.rol.nombre === "ENCARGADO_VENTAS" && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Gestión de ventas y caja
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Registro de clientes
                    </div>
                  </>
                )}
                {user.rol.nombre === "ENCARGADO_STOCK" && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Gestión de inventario y stock
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                      Administración de proveedores
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border bg-panel">
          <div className="flex items-center gap-3">
            {onEdit && (
              <Button
                variant="default"
                onClick={() => onEdit(user)}
                leftIcon={<Edit3 size={16} />}
                className="flex-1"
              >
                Editar
              </Button>
            )}
            {onChangePassword && (
              <Button
                variant="secondary"
                onClick={() => onChangePassword(user.id)}
                leftIcon={<Key size={16} />}
                className="flex-1"
              >
                Cambiar Contraseña
              </Button>
            )}
            {onToggle && !isPrimaryAdmin && (
              <Button
                variant={user.activo ? "danger" : "success"}
                onClick={() => onToggle(user.id)}
                leftIcon={user.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                className="flex-1"
              >
                {user.activo ? "Desactivar" : "Reactivar"}
              </Button>
            )}
            {isPrimaryAdmin && (
              <div className="flex-1 text-center text-[10px] text-[var(--warning)] bg-[var(--warning-light)] border border-[var(--warning)]/20 rounded-[var(--radius-md)] py-2 px-3">
                Administrador principal — protegido
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}