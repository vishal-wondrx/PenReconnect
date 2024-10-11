
import React, { useEffect, useState, useCallback, useRef } from 'react';

const PEN_SERVICE_UUID_16 = 0x19f1;
const PEN_CHARACTERISTICS_WRITE_UUID_16 = 0x2ba0;
const PEN_CHARACTERISTICS_NOTIFICATION_UUID_16 = 0x2ba1;

const PEN_SERVICE_UUID_128 = "4f99f138-9d53-5bfa-9e50-b147491afe68";
const PEN_CHARACTERISTICS_WRITE_UUID_128 = "8bc8cc7d-88ca-56b0-af9a-9bf514d0d61a";
const PEN_CHARACTERISTICS_NOTIFICATION_UUID_128 = "64cd86b1-2256-5aeb-9f04-2caf6c60ae57";



const RECONNECT_INTERVAL = 10000; // 10 seconds

const BLEDevice = () => {
    const [device, setDevice] = useState(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);
    const reconnectTimeoutRef = useRef(null);

    const connectGATT = async (device) => {
        if (!device.gatt.connected) {
            await device.gatt.connect();
        }
        return device;
    };

    const saveDeviceInfo = (device) => {
        const deviceInfo = {
            id: device.id,
            name: device.name,
        };
        localStorage.setItem('lastConnectedDevice', JSON.stringify(deviceInfo));
    };

    const connectToDevice = async () => {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [PEN_SERVICE_UUID_16] }],
                // acceptAllDevices: true,
            });
            await connectGATT(device);
            setDevice(device);
            saveDeviceInfo(device);
        } catch (error) {
            console.error('Connection failed', error);
        }
    };

    const reconnectToDevice = useCallback(async (userInitiated = false) => {
        if (device && device.gatt.connected) return;
        const storedDeviceInfo = JSON.parse(localStorage.getItem('lastConnectedDevice'));
        if (!storedDeviceInfo) return;

        setIsReconnecting(true);
        try {
            console.log("in try userInitiated", userInitiated);
            let targetDevice;

            if (navigator.bluetooth.getDevices) {
                console.log("navigator.bluetooth.getDevices",navigator.bluetooth.getDevices)
                const devices = await navigator.bluetooth.getDevices();
                targetDevice = devices.find((d) => d.id === storedDeviceInfo.id);
            }

            if (targetDevice) {
                console.log("in if targetDevice", targetDevice);

                await connectGATT(targetDevice);
                setDevice(targetDevice);
                console.log('Reconnected to device');
            } else if (userInitiated) {
                // Only attempt requestDevice if the user has initiated the action
                targetDevice = await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [PEN_SERVICE_UUID_16] },
                        { name: storedDeviceInfo.name },
                        { deviceId: storedDeviceInfo.id },
                    ],
                    // optionalServices: ['your_optional_service_uuid_here'],
                    // acceptAllDevices: true,
                });
                console.log("target device", targetDevice);
                if (targetDevice) {
                    await connectGATT(targetDevice);
                    setDevice(targetDevice);
                }
            } else {
                // If not user initiated and device not found, show reconnect prompt
                setShowReconnectPrompt(true);
            }
        } catch (error) {
            console.error('Reconnection failed', error);
            setShowReconnectPrompt(true);
        } finally {
            setIsReconnecting(false);
        }
    }, [device]);

    const startReconnectionService = useCallback(() => {
        reconnectTimeoutRef.current = setTimeout(() => {
            if (!device || !device.gatt.connected) {
                reconnectToDevice(false);
            }
            startReconnectionService();
        }, RECONNECT_INTERVAL);
    }, [device, reconnectToDevice]);

    useEffect(() => {
        reconnectToDevice(false);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                reconnectToDevice(false);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        startReconnectionService();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [reconnectToDevice, startReconnectionService]);

    const handleDisconnect = useCallback(() => {
        setDevice(null);
        reconnectToDevice(false);
    }, [reconnectToDevice]);

    useEffect(() => {
        if (device) {
            device.addEventListener('gattserverdisconnected', handleDisconnect);
        }
        return () => {
            if (device) {
                device.removeEventListener('gattserverdisconnected', handleDisconnect);
            }
        };
    }, [device, handleDisconnect]);

    return (
        <div>
            {device ? (
                <p>Connected to: {device.name}</p>
            ) : isReconnecting ? (
                <p>Attempting to reconnect...</p>
            ) : showReconnectPrompt ? (
                <div>
                    <p>Connection lost. Would you like to reconnect?</p>
                    <button onClick={() => reconnectToDevice(true)}>Reconnect</button>
                </div>
            ) : (
                <button onClick={() => connectToDevice()}>Connect to Device</button>
            )}
        </div>
    );
};

export default BLEDevice;