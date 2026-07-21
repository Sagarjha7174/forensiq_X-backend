const express = require('express');
const prisma = require("../../config/database/prismaClient");

const blockUser = async (req, res) => {
    const { id } = req.params; 

    try {
        
        const user = await prisma.user.findUnique({
            where: { id: id },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: id },
            data: {
                isActive: false, 
            },
        });

        
        res.status(200).json({
            message: `User ${updatedUser.name} has been blocked.`,
            isActive: updatedUser.isActive,
        });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({ error: 'An error occurred while blocking the user.' });
    }
};

module.exports = { blockUser };
