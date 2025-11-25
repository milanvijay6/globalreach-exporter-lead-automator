import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Upload, X, Building2, Image as ImageIcon, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { CompanyDetails } from '../types';
import { CompanyConfigService } from '../services/companyConfigService';
import { validateCompanyDetails } from '../services/validationService';
import { canManageCompanyConfig } from '../services/permissionService';
import { User } from '../types';
import { Logger } from '../services/loggerService';

interface CompanyDetailsPanelProps {
  user?: User;
}

const CompanyDetailsPanel: React.FC<CompanyDetailsPanelProps> = ({ user }) => {
  const [details, setDetails] = useState<Partial<CompanyDetails>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<string[]>([]);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const certificateInputRef = useRef<HTMLInputElement>(null);

  const canEdit = user ? canManageCompanyConfig(user) : false;

  const loadCompanyDetails = useCallback(async () => {
    try {
      setLoading(true);
      const existing = await CompanyConfigService.getCompanyDetails();
      if (existing) {
        setDetails(existing);
        if (existing.logoUrl) {
          // Load logo preview
          if (existing.logoUrl.startsWith('data:') || existing.logoUrl.startsWith('blob:')) {
            setLogoPreview(existing.logoUrl);
          } else {
            // For Electron paths, try to load
            setLogoPreview(existing.logoUrl);
          }
        }
        setDocuments(existing.registrationDocuments || []);
        setCertificates(existing.certificates || []);
      }
    } catch (error) {
      Logger.error('[CompanyDetailsPanel] Failed to load details:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanyDetails();
  }, [loadCompanyDetails]);

  const handleInputChange = (field: keyof CompanyDetails, value: string) => {
    setDetails(prev => ({ ...prev, [field]: value }));
    setErrors([]);
    setSuccess(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = await CompanyConfigService.uploadCompanyLogo(file);
      setDetails(prev => ({ ...prev, logoUrl: path }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setErrors([error.message || 'Failed to upload logo']);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = await CompanyConfigService.uploadCompanyDocument(file, 'registration');
      setDocuments(prev => [...prev, path]);
    } catch (error: any) {
      setErrors([error.message || 'Failed to upload document']);
    }
  };

  const handleCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = await CompanyConfigService.uploadCompanyDocument(file, 'certificate');
      setCertificates(prev => [...prev, path]);
    } catch (error: any) {
      setErrors([error.message || 'Failed to upload certificate']);
    }
  };

  const removeDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const removeCertificate = (index: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setErrors([]);
    setSuccess(false);

    const validation = validateCompanyDetails(details);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      const now = Date.now();
      const companyDetails: CompanyDetails = {
        id: details.id || `company_${now}`,
        companyName: details.companyName!,
        phone: details.phone!,
        email: details.email!,
        contactPersonName: details.contactPersonName!,
        websiteUrl: details.websiteUrl,
        contactPersonTitle: details.contactPersonTitle,
        logoUrl: details.logoUrl,
        registrationDocuments: documents,
        certificates: certificates,
        createdAt: details.createdAt || now,
        updatedAt: now,
      };

      await CompanyConfigService.saveCompanyDetails(companyDetails);
      await CompanyConfigService.setCompanySetupComplete(true);
      setSuccess(true);
      Logger.info('[CompanyDetailsPanel] Company details saved');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setErrors([error.message || 'Failed to save company details']);
      Logger.error('[CompanyDetailsPanel] Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading company details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
        <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Company Information
        </h3>
        <p className="text-xs text-indigo-700">
          Configure your company details to personalize AI-generated messages and quotes. This information is optional and can be completed anytime.
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
          {errors.map((error, i) => (
            <div key={i} className="text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ))}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
          <div className="text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Company details saved successfully!
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={details.companyName || ''}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Your Company Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={details.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={details.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="contact@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={details.websiteUrl || ''}
              onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="https://www.company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contact Person Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={details.contactPersonName || ''}
              onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Contact Person Title
            </label>
            <input
              type="text"
              value={details.contactPersonTitle || ''}
              onChange={(e) => handleInputChange('contactPersonTitle', e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="Owner / Director / Manager"
            />
          </div>
        </div>

        {/* Right Column: Logo and Documents */}
        <div className="space-y-4">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Company Logo
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="max-h-32 mx-auto" />
                  {canEdit && (
                    <button
                      onClick={() => {
                        setLogoPreview(null);
                        setDetails(prev => ({ ...prev, logoUrl: undefined }));
                      }}
                      className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500 mb-2">Upload company logo</p>
                  {canEdit && (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                    >
                      <Upload className="w-3 h-3 inline mr-1" /> Choose File
                    </button>
                  )}
                </div>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Registration Documents */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Registration Documents
            </label>
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-700">{doc.split('/').pop() || `Document ${index + 1}`}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeDocument(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <button
                  onClick={() => documentInputRef.current?.click()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Add Document
                </button>
              )}
              <input
                ref={documentInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleDocumentUpload}
                className="hidden"
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* Certificates */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Certificates
            </label>
            <div className="space-y-2">
              {certificates.map((cert, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-700">{cert.split('/').pop() || `Certificate ${index + 1}`}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeCertificate(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <button
                  onClick={() => certificateInputRef.current?.click()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Add Certificate
                </button>
              )}
              <input
                ref={certificateInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleCertificateUpload}
                className="hidden"
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Company Details
              </>
            )}
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <p className="text-sm text-yellow-700">
            You have read-only access. Contact an administrator to edit company details.
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanyDetailsPanel;

