import {RouterProvider} from 'react-router-dom';
import {App as AntdApp, ConfigProvider, theme} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from './router';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import './App.css';

// 设置 dayjs 为中文
dayjs.locale('zh-cn');

function App() {
    return (
        <ConfigProvider
            locale={zhCN}
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#2dd4bf', // teal-400 (brighter for dark mode)
                    colorBgContainer: '#1e293b', // slate-800
                    colorBgElevated: '#0f172a', // slate-900
                    borderRadius: 8,
                    wireframe: false,
                },
                components: {
                    Table: {
                        colorBgContainer: 'transparent',
                        headerBg: 'rgba(255,255,255,0.02)',
                    },
                    Card: {
                        colorBgContainer: 'rgba(30, 41, 59, 0.5)', // Transparent slate-800
                    },
                    Modal: {
                        contentBg: '#0f172a',
                        headerBg: '#0f172a',
                    }
                }
            }}
        >
            <AntdApp>
                <RouterProvider router={router}/>
            </AntdApp>
        </ConfigProvider>
    );
}

export default App;
