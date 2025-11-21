import {RouterProvider} from 'react-router-dom';
import {App as AntdApp, ConfigProvider} from 'antd';
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
                token: {
                    colorPrimary: '#0d9488', // teal-600
                },
            }}
        >
            <AntdApp>
                <RouterProvider router={router}/>
            </AntdApp>
        </ConfigProvider>
    );
}

export default App;
