// @ts-nocheck

'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { blockchainService } from '@/services/blockchainService'
// import { toast } from "@/components/ui/use-toast"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ethers } from 'ethers'

interface CartManagerProps {
    address: string
}

const CartStatus = ['Active', 'Abandoned', 'Completed', 'Expired']

export function CartManager({ address }: CartManagerProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [carts, setCarts] = useState<any[]>([])
    const [newCart, setNewCart] = useState({
        cartId: '',
        amount: ''
    })

    const loadCarts = async () => {
        try {
            const userCarts = await blockchainService.getUserCarts(address)
            setCarts(userCarts)
        } catch (error: any) {
            console.error('Error loading carts:', error)
            // toast({
            //     title: "Error",
            //     description: error.message || "Failed to load carts",
            //     variant: "destructive",
            // })
        }
    }

    useEffect(() => {
        if (address) {
            loadCarts()
        }
    }, [address])

    const handleCreateCart = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            await blockchainService.createCart(newCart.cartId, newCart.amount)
            // toast({
            //     title: "Success",
            //     description: "Cart created successfully",
            // })
            setNewCart({ cartId: '', amount: '' })
            await loadCarts()
        } catch (error: any) {
            console.error('Error creating cart:', error)
            // toast({
            //     title: "Error",
            //     description: error.message || "Failed to create cart",
                // variant: "destructive",
            // })
        } finally {
            setIsLoading(false)
        }
    }

    const handleProcessPayment = async (cartId: string, amount: string) => {
        setIsLoading(true)
        try {
            await blockchainService.processPayment(cartId, amount)
            // toast({
            //     title: "Success",
            //     description: "Payment processed successfully",
            // })
            await loadCarts()
        } catch (error: any) {
            console.error('Error processing payment:', error)
            // toast({
            //     title: "Error",
            //     description: error.message || "Failed to process payment",
                // variant: "destructive",
            // })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create New Cart</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateCart} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="cartId">Cart ID</Label>
                            <Input
                                id="cartId"
                                value={newCart.cartId}
                                onChange={(e) => setNewCart(prev => ({
                                    ...prev,
                                    cartId: e.target.value
                                }))}
                                placeholder="Enter unique cart ID"
                                required
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (AVAX)</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                value={newCart.amount}
                                onChange={(e) => setNewCart(prev => ({
                                    ...prev,
                                    amount: e.target.value
                                }))}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Cart'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Your Carts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cart ID</TableHead>
                                <TableHead>Amount (AVAX)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {carts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">
                                        No carts found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                carts.map((cart: any) => (
                                    <TableRow key={cart.cartId}>
                                        <TableCell>{cart.cartId}</TableCell>
                                        <TableCell>{ethers.formatEther(cart.amount)} AVAX</TableCell>
                                        <TableCell>{CartStatus[cart.status]}</TableCell>
                                        <TableCell>
                                            {cart.status === 0 && ( // Active
                                                <Button
                                                    onClick={() => handleProcessPayment(cart.cartId, ethers.formatEther(cart.amount))}
                                                    disabled={isLoading}
                                                    size="sm"
                                                >
                                                    Pay Now
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
