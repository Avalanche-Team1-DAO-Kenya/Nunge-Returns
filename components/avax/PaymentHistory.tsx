'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { blockchainService } from '@/services/blockchainService'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface PaymentHistoryProps {
    address: string
}

export function PaymentHistory({ address }: PaymentHistoryProps) {
    const [payments, setPayments] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const loadPayments = async () => {
        setIsLoading(true)
        try {
            const userCarts = await blockchainService.getUserCarts(address)
            // Filter only completed payments
            const completedCarts = userCarts.filter((cart: any) => cart.status === 2) // Status.Completed
            setPayments(completedCarts)
        } catch (error) {
            console.error('Error loading payment history:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadPayments()
    }, [address])

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-4">Loading...</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cart ID</TableHead>
                                <TableHead>Amount (AVAX)</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((payment: any) => (
                                <TableRow key={payment.cartId}>
                                    <TableCell>{payment.cartId}</TableCell>
                                    <TableCell>{payment.amount.toString()}</TableCell>
                                    <TableCell>
                                        {new Date(payment.lastUpdated * 1000).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-green-600">Completed</span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {payments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4">
                                        No payment history found
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
