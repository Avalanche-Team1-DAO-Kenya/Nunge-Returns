// @ts-nocheck

'use client'

import React, { useState, useEffect } from 'react'
import { blockchainService } from '@/services/blockchainService'
import { ethers } from 'ethers'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Log {
    type: string
    kraPin?: string
    sessionId?: string
    amount?: string
    timestamp: Date
    transactionHash: string
    paymentReference?: string
    status?: string
    tokenId?: string
    attempt?: number
    category: string
}

export const BlockchainLogs = () => {
    const [logs, setLogs] = useState<{
        sessions: any[]
        statusUpdates: any[]
        payments: any[]
        certificates: any[]
    }>({
        sessions: [],
        statusUpdates: [],
        payments: [],
        certificates: []
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshInterval, setRefreshInterval] = useState<number>(10000) // 10 seconds default

    const loadAllLogs = async () => {
        try {
            setLoading(true)
            const allLogs = await blockchainService.getAllLogs()
            setLogs(allLogs)
            setError(null)
        } catch (error) {
            console.error('Error loading blockchain logs:', error)
            setError(error instanceof Error ? error.message : 'Failed to load blockchain logs')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAllLogs()
        const interval = setInterval(loadAllLogs, refreshInterval)
        return () => clearInterval(interval)
    }, [refreshInterval])

    const formatEventData = (event: any) => {
        const baseData = {
            transactionHash: event.transactionHash,
            timestamp: event.timestamp,
        }

        switch (event.type) {
            case 'SessionCreated':
                return {
                    ...baseData,
                    type: 'Session Recorded',
                    kraPin: event.kraPin?.toString() || '',
                    sessionId: event.sessionId?.toString() || '',
                    amount: event.amount?.toString() || '0',
                }
            case 'SessionStatusUpdated':
                return {
                    ...baseData,
                    type: 'Status Update',
                    sessionId: event.sessionId?.toString() || '',
                    status: event.status?.toString() || 'Unknown',
                }
            case 'PaymentRecorded':
                return {
                    ...baseData,
                    type: 'Payment Recorded',
                    sessionId: event.sessionId?.toString() || '',
                    paymentReference: event.paymentReference?.toString() || '',
                }
            case 'CertificateIssued':
                return {
                    ...baseData,
                    type: 'Certificate Issued',
                    tokenId: event.tokenId?.toString() || '',
                    recipient: event.recipient?.toString() || '',
                    name: event.name?.toString() || '',
                }
            default:
                return baseData
        }
    }

    const allLogs = [
        ...logs.sessions.map(event => formatEventData({ ...event, type: 'SessionCreated' })),
        ...logs.statusUpdates.map(event => formatEventData({ ...event, type: 'SessionStatusUpdated' })),
        ...logs.payments.map(event => formatEventData({ ...event, type: 'PaymentRecorded' })),
        ...logs.certificates.map(event => formatEventData({ ...event, type: 'CertificateIssued' }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (loading && !allLogs.length) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-red-600 bg-red-50 rounded-md">
                <p>Error loading blockchain logs: {error}</p>
            </div>
        )
    }

    if (!allLogs.length) {
        return (
            <div className="text-center p-4 text-muted-foreground">
                No blockchain activity found
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Blockchain Activity</h3>
                <button
                    onClick={loadAllLogs}
                    className="text-xs text-blue-600 hover:text-blue-800"
                >
                    Refresh
                </button>
            </div>
            <Table>
                <TableCaption>A list of recent blockchain transactions.</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Index</TableHead>
                        <TableHead>Type</TableHead>
                        {/* <TableHead>KRA PIN</TableHead> */}
                        <TableHead>Session ID</TableHead>
                        <TableHead>Amount</TableHead>
                        {/* <TableHead>Status</TableHead> */}
                        {/* <TableHead>Payment Ref</TableHead> */}
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Transaction</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allLogs.map((log, index) => (
                        <TableRow key={`${log.transactionHash}-${index}`}>
                            <TableCell className='text-center'>{index + 1}</TableCell>
                            <TableCell>
                                <span className="inline-block px-2 py-1 text-xs font-medium rounded-full"
                                    style={{
                                        backgroundColor: getEventColor(log.type),
                                        color: 'white'
                                    }}
                                >
                                    {log.type}
                                </span>
                            </TableCell>
                            {/* <TableCell>{log.kraPin}</TableCell> */}
                            <TableCell>{log.sessionId}</TableCell>
                            <TableCell>{log.amount ? `${ethers.formatEther(log.amount)} AVAX` : '-'}</TableCell>
                            {/* <TableCell>{log.status}</TableCell> */}
                            {/* <TableCell>{log.paymentReference}</TableCell> */}
                            <TableCell>{log.timestamp.toLocaleString()}</TableCell>
                            <TableCell>
                                <a
                                    href={`https://testnet.snowtrace.io/tx/${log.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    View Transaction
                                </a>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function getEventColor(type: string): string {
    switch (type) {
        case 'Session Recorded':
            return '#4F46E5' // Indigo
        case 'Status Update':
            return '#059669' // Emerald
        case 'Payment Recorded':
            return '#0EA5E9' // Sky
        case 'Certificate Issued':
            return '#7C3AED' // Violet
        default:
            return '#6B7280' // Gray
    }
}