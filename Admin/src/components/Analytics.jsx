import * as React from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
    Typography, Select, MenuItem, Box, useTheme,
    Paper, Container, CircularProgress, alpha
} from "@mui/material";
import { LineChart, PieChart } from "@mui/x-charts";
import CompleteIcon from "../assets/Complete.png";
import PendingIcon from "../assets/Pending.png";
import SalesIcon from "../assets/sales.png";
import ProductIcon from "../assets/Product.png";
import CancelIcon from "../assets/cancel.png";
import "../components/Analytics.css";

const KPICard = ({ icon, title, value, color }) => {
    return (
        <Paper elevation={0} className="glass-card kpi-card-centered" style={{ border: '1.5px solid #000' }}>
            <Box
                className="kpi-card-centered-icon"
                style={{
                    background: alpha(color, 0.1),
                    border: `1.5px solid ${alpha(color, 0.3)}`,
                }}
            >
                <img src={icon} alt={title} style={{ width: 28, height: 28, objectFit: "contain" }} />
            </Box>
            <Typography className="kpi-card-centered-value">{value}</Typography>
            <Typography className="kpi-card-centered-label">{title}</Typography>
        </Paper>
    );
};

const getDateRange = (period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    
    switch (period) {
        case "thisWeek":
            const firstDayOfWeek = new Date(today);
            firstDayOfWeek.setDate(today.getDate() - today.getDay());
            start.setTime(firstDayOfWeek.getTime());
            return { start, end: new Date(today) };
        case "last3Days":
            start.setDate(today.getDate() - 2);
            return { start, end: new Date(today) };
        case "last7Days":
            start.setDate(today.getDate() - 6);
            return { start, end: new Date(today) };
        case "lastWeek":
            const lastWeekEnd = new Date(today);
            lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
            const lastWeekStart = new Date(lastWeekEnd);
            lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
            return { start: lastWeekStart, end: lastWeekEnd };
        case "lastMonth":
            const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            lastMonthEnd.setHours(0, 0, 0, 0);
            return { start: lastMonthStart, end: lastMonthEnd };
        default:
            return { start: null, end: null };
    }
};

export default function Analytics() {
    const [loading, setLoading] = React.useState(true);
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
    const [availableYears, setAvailableYears] = React.useState([]);
    const [monthlyData, setMonthlyData] = React.useState([]);
    const [categoryData, setCategoryData] = React.useState([]);
    const [timePeriod, setTimePeriod] = React.useState("all");
    
    // KPI States
    const [stats, setStats] = React.useState({
        completed: 0,
        pending: 0,
        revenue: 0,
        products: 0,
        cancelled: 0
    });

React.useEffect(() => {
    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const [ordersSnap, completedSnap, cancelledSnap, deliverySnap, productsSnap] = await Promise.all([
                getDocs(collection(db, "Orders")),
                getDocs(collection(db, "Completed_Orders")),
                getDocs(collection(db, "Cancelled_Orders")),
                getDocs(collection(db, "To_Deliver_Orders")),
                getDocs(collection(db, "Products"))
            ]);

            const processDoc = (doc, dateField = 'createdAt') => {
                const data = doc.data();
                const dateObj = data[dateField] || data.createdAt || data.cancelledAt;
                const date = dateObj?.toDate ? dateObj.toDate() : new Date(dateObj || Date.now());
                return { 
                    year: date.getFullYear(), 
                    month: date.getMonth(), 
                    amount: Number(data.totalAmount || 0),
                    date: date,
                    // Default to Uncategorized if items array is missing
                    category: data.items?.[0]?.category || 'Uncategorized' 
                };
            };

            const allOrders = ordersSnap.docs.map(d => processDoc(d, 'createdAt'));
            const allCompleted = completedSnap.docs.map(d => processDoc(d, 'completedAt'));
            const allCancelled = cancelledSnap.docs.map(d => processDoc(d, 'cancelledAt'));
            const allDelivery = deliverySnap.docs.map(d => processDoc(d, 'createdAt'));

            // Years & Time Period Filtering
            const years = Array.from(new Set([...allOrders, ...allCompleted].map(d => d.year))).sort((a, b) => b - a);
            setAvailableYears(years.length > 0 ? years : [new Date().getFullYear()]);

            const { start: periodStart, end: periodEnd } = getDateRange(timePeriod);
            const filterByTimePeriod = (data) => {
                if (!periodStart || !periodEnd || timePeriod === "all") return data;
                return data.filter(d => {
                    const dDate = new Date(d.date);
                    dDate.setHours(0, 0, 0, 0);
                    return dDate >= periodStart && dDate <= periodEnd;
                });
            };

            const filteredOrders = filterByTimePeriod(allOrders);
            const filteredCompleted = filterByTimePeriod(allCompleted);
            const filteredCancelled = filterByTimePeriod(allCancelled);
            const filteredDelivery = filterByTimePeriod(allDelivery);

            // Chart Data Mapping
            let chartMap;
            if (timePeriod === "all") {
                // Monthly breakdown for selected year
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                chartMap = monthNames.map(name => ({ monthName: name, orders: 0, completed: 0, cancelled: 0 }));

                filteredOrders.forEach(d => { if(d.year === selectedYear) chartMap[d.month].orders++; });
                filteredCompleted.forEach(d => { if(d.year === selectedYear) chartMap[d.month].completed++; });
                filteredCancelled.forEach(d => { if(d.year === selectedYear) chartMap[d.month].cancelled++; });
            } else {
                // Daily breakdown for specific time period
                const dateMap = {};
                const { start, end } = getDateRange(timePeriod);
                
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dateMap[dateStr] = { date: dateStr, orders: 0, completed: 0, cancelled: 0 };
                }

                filteredOrders.forEach(d => {
                    const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (dateMap[dateStr]) dateMap[dateStr].orders++;
                });
                filteredCompleted.forEach(d => {
                    const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (dateMap[dateStr]) dateMap[dateStr].completed++;
                });
                filteredCancelled.forEach(d => {
                    const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (dateMap[dateStr]) dateMap[dateStr].cancelled++;
                });

                chartMap = Object.values(dateMap);
            }

            // --- CATEGORY FILTERING LOGIC ---
            const allowedCategories = ['Fish', 'Mollusk', 'Crustacean', 'Trend'];
            const categoryMap = {};
            allowedCategories.forEach(cat => categoryMap[cat] = 0);

            filteredCompleted.forEach(d => {
                if (allowedCategories.includes(d.category)) {
                    categoryMap[d.category]++;
                }
            });

            const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];
            const categoryPieData = allowedCategories.map((name, index) => ({
                id: index,
                value: categoryMap[name],
                label: name,
                color: colors[index]
            })).filter(item => item.value > 0); // Only show categories that have sales

            // Set States
            setMonthlyData(chartMap);
            setCategoryData(categoryPieData);
            setStats({
                completed: filteredCompleted.length,
                pending: filterByTimePeriod(allDelivery).length,
                revenue: filteredCompleted.reduce((sum, d) => sum + d.amount, 0),
                products: productsSnap.docs.length,
                cancelled: filterByTimePeriod(allCancelled).length
            });
            
            // (Keep your existing chartMap logic for MonthlyData here...)

        } catch (error) {
            console.error("Analytics Error:", error);
        } finally {
            setLoading(false);
        }
    };
    fetchAnalytics();
}, [selectedYear, timePeriod]);

    if (loading) return <Box className="analytics-loading-box"><CircularProgress thickness={5} size={50} /></Box>;

    return (
        <Container maxWidth="xl" className="analytics-container">
            {/* KPI Title */}
            <Typography className="analytics-section-title">Revenue & Order Insights</Typography>
            
            {/* KPI Section */}
            <div className="analytics-kpi-flex">
                <KPICard icon={CompleteIcon} title="Completed" value={stats.completed} color="#f0f0f0" />
                <KPICard icon={PendingIcon} title="Pending" value={stats.pending} color="#f0f0f0" />
                <KPICard icon={SalesIcon} title="Revenue" value={`₱${stats.revenue.toLocaleString()}`} color="#f0f0f0" />
                <KPICard icon={ProductIcon} title="Products" value={stats.products} color="#f0f0f0" />
                <KPICard icon={CancelIcon} title="Cancelled" value={stats.cancelled} color="#f0f0f0" />
            </div>

            {/* Main Chart Cards */}
            <Box className="analytics-charts-container">
                {/* Orders Growth Chart */}
                <Paper className="glass-card analytics-chart-paper">
                    <Box className="analytics-chart-header-flex">
                        <Box>
                            <Typography className="analytics-chart-title">Orders Growth</Typography>
                            <Typography className="analytics-chart-caption">ANNUAL PERFORMANCE METRICS</Typography>
                        </Box>
                        <Box style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <Select 
                                value={timePeriod} 
                                onChange={(e) => setTimePeriod(e.target.value)} 
                                size="small"
                                className="analytics-year-select"
                            >
                                <MenuItem value="all">All Time</MenuItem>
                                <MenuItem value="thisWeek">This Week</MenuItem>
                                <MenuItem value="last3Days">Last 3 Days</MenuItem>
                                <MenuItem value="last7Days">Last 7 Days</MenuItem>
                                <MenuItem value="lastWeek">Last Week</MenuItem>
                                <MenuItem value="lastMonth">Last Month</MenuItem>
                            </Select>
                            {timePeriod === "all" && (
                                <Select 
                                    value={selectedYear} 
                                    onChange={(e) => setSelectedYear(Number(e.target.value))} 
                                    size="small"
                                    className="analytics-year-select"
                                >
                                    {availableYears.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                                </Select>
                            )}
                        </Box>
                    </Box>

                    <Box className="analytics-chart-box">
                        <LineChart
                            dataset={monthlyData}
                            xAxis={[{ 
                                dataKey: timePeriod === "all" ? 'monthName' : 'date', 
                                scaleType: 'point',
                                disableTicks: true,
                                padding: { left: 10, right: 10 }
                            }]}
                            series={[
                                { dataKey: 'orders', label: 'Pending Orders', color: '#06b6d4', curve: 'catmullRom', area: true },
                                { dataKey: 'completed', label: 'Completed Orders', color: '#ec4899', curve: 'catmullRom', area: true },
                                { dataKey: 'cancelled', label: 'Cancelled', color: '#3b82f6', curve: 'catmullRom', area: true },
                            ]}
                            height={320}
                            margin={{ left: 50, right: 40, top: 20, bottom: 30 }}
                            slotProps={{ legend: { padding: 0 } }}
                            className="custom-analytics-chart"
                        />
                    </Box>
                </Paper>

                {/* Orders Distribution Pie Chart */}
                <Paper className="glass-card analytics-pie-chart-paper">
                    <Box className="analytics-pie-header">
                        <Typography className="analytics-chart-title">Order Distribution</Typography>
                        <Typography className="analytics-chart-caption">BY CATEGORY</Typography>
                    </Box>
                    <Box className="analytics-pie-box">
                        {categoryData.length > 0 ? (
                            <PieChart
                                series={[
                                    {
                                        data: categoryData,
                                        innerRadius: 90,
                                        outerRadius: 150,
                                        paddingAngle: 2,
                                        cornerRadius: 8,
                                    }
                                ]}
                                width={400}
                                height={400}
                                margin={{top: -50, bottom: 20, left: 0, right: 0 }}
                                slotProps={{ legend: { padding: 0, position: 'bottom' } }}
                                className="custom-pie-chart"
                            />
                        ) : (
                            <Typography className="no-data-message">No category data available</Typography>
                        )}
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}