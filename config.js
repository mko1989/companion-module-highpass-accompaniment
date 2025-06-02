export function getConfigFields() {
    return [
        {
            type: 'textinput',
            id: 'host',
            label: 'acCompaniment IP Address',
            width: 8,
            default: '127.0.0.1',
        },
        {
            type: 'number',
            id: 'port',
            label: 'acCompaniment Port',
            width: 4,
            default: 8877, // Should match the port in Electron app
            min: 1,
            max: 65535,
        },
        {
            type: 'checkbox',
            id: 'reconnect',
            label: 'Attempt Reconnect',
            default: true,
        }
    ];
} 