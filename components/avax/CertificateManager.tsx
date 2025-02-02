// @ts-nocheck

'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { blockchainService } from '@/services/blockchainService'
// import { toast } from "@/components/ui/use-toast"

interface CertificateManagerProps {
    address: string
}

export function CertificateManager({ address }: CertificateManagerProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState({
        recipientAddress: '',
        courseName: '',
        recipientName: '',
        tokenId: ''
    })

    const handleIssueCertificate = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const metadata = await blockchainService.generateCertificateMetadata(
                formData.courseName,
                formData.recipientName,
                new Date()
            )
            
            await blockchainService.issueCertificate(
                formData.recipientAddress,
                formData.courseName,
                formData.recipientName,
                "Nunge Returns",
                metadata
            )
            
            toast({
                title: "Success",
                description: "Certificate issued successfully",
            })
            
            // Reset form
            setFormData({
                recipientAddress: '',
                courseName: '',
                recipientName: '',
                tokenId: ''
            })
        } catch (error: any) {
            console.error('Error issuing certificate:', error)
            toast({
                title: "Error",
                description: error.message || "Failed to issue certificate",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyCertificate = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const isValid = await blockchainService.verifyCertificate(parseInt(formData.tokenId))
            const certificate = await blockchainService.getCertificate(parseInt(formData.tokenId))
            
            toast({
                title: isValid ? "Certificate Valid" : "Certificate Invalid",
                description: isValid 
                    ? `Certificate for ${certificate.recipientName} - ${certificate.courseName}`
                    : "This certificate is not valid",
            })
        } catch (error: any) {
            console.error('Error verifying certificate:', error)
            toast({
                title: "Error",
                description: error.message || "Failed to verify certificate",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Issue Certificate</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleIssueCertificate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="recipientAddress">Recipient Address</Label>
                            <Input
                                id="recipientAddress"
                                value={formData.recipientAddress}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    recipientAddress: e.target.value
                                }))}
                                placeholder="0x..."
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="courseName">Course Name</Label>
                            <Input
                                id="courseName"
                                value={formData.courseName}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    courseName: e.target.value
                                }))}
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="recipientName">Recipient Name</Label>
                            <Input
                                id="recipientName"
                                value={formData.recipientName}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    recipientName: e.target.value
                                }))}
                                required
                            />
                        </div>
                        
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Issuing...' : 'Issue Certificate'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Verify Certificate</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleVerifyCertificate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tokenId">Certificate ID</Label>
                            <Input
                                id="tokenId"
                                value={formData.tokenId}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    tokenId: e.target.value
                                }))}
                                placeholder="Enter certificate ID"
                                required
                            />
                        </div>
                        
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Verify Certificate'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
