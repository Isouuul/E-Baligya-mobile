import * as React from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import Typography from "@mui/material/Typography";
import {
    Select, MenuItem, Box, useTheme,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, List, ListItem, ListItemText, ListItemIcon,
    TablePagination, Grid, Container
} from "@mui/material";
import { LineChart, PieChart } from "@mui/x-charts";
import { format } from "date-fns";
import "../components/Analytics.css";

// Icon paths
const ICON_PATHS = {
    CompletedOrders: "../src/assets/Complete.png",
    DeliveryToday: "../src/assets/ToDeliver.png",
    TotalRevenue: "../src/assets/Points.png",
    Product: "../src/assets/Product.png",
    Cancel: "../src/assets/cancel.png",
    Trash: "../src/assets/Trash.png",
};

// Helper function to calculate revenue from items
const calculateItemRevenue = (item) => Number(item.price * item.quantity || item.price || 0);

// Custom color palette
const CUSTOM_PALETTE = [
    '#00bcd4', '#ff9800', '#4caf50', '#9c27b0', 
    '#f44336', '#2196f3', '#ffeb3b'
];

// New Responsive Card Component
const KPICard = ({ icon, title, value, color }) => (
    <Paper 
        elevation={2}
        sx={{ 
            p: { xs: 1.5, sm: 2 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: 2,
            transition: 'all 0.2s ease',
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            border: `2px solid ${color}20`,
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '3px',
                backgroundColor: color,
            },
            '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
                borderColor: `${color}40`,
            }
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, mb: 1 }}>
            {typeof icon === 'string' ? (
                <Box
                    component="img"
                    src={icon}
                    alt={title}
                    sx={{
                        width: { xs: 40, sm: 48 },
                        height: { xs: 40, sm: 48 },
                        objectFit: 'contain',
                        flexShrink: 0
                    }}
                />
            ) : (
                <Box sx={{ fontSize: { xs: 40, sm: 48 }, color: color }}>
                    {icon}
                </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                    variant="body2"
                    sx={{ 
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        color: 'text.secondary',
                        fontWeight: 500,
                        mb: 0.5
                    }}
                >
                    {title}
                </Typography>
                <Typography 
                    variant="h6"
                    sx={{ 
                        color: color,
                        fontWeight: 700,
                        fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                        lineHeight: 1.2,
                        wordBreak: 'break-word'
                    }}
                >
                    {value}
                </Typography>
            </Box>
        </Box>
    </Paper>
);

export default function Analytics() {
    const [period, setPeriod] = React.useState("overall");
    const [completedOrders, setCompletedOrders] = React.useState(0);
    const [deliveryToday, setDeliveryToday] = React.useState(0);
    const [totalRevenue, setTotalRevenue] = React.useState(0);
    const [graphData, setGraphData] = React.useState([]);
    const [categories, setCategories] = React.useState([]);
    const [monthlyData, setMonthlyData] = React.useState([]);
    const [availableYears, setAvailableYears] = React.useState([]);
    const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
    const [totalProducts, setTotalProducts] = React.useState(0);
    const [cancelledOrders, setCancelledOrders] = React.useState(0);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const [loading, setLoading] = React.useState(true);

    const theme = useTheme();

    // Helper function to check if a date falls within the selected period
    const isInPeriod = React.useCallback((dateObj) => {
        if (!dateObj) return false;
        const date = dateObj?.toDate ? dateObj.toDate() : new Date(dateObj);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        switch (period) {
            case "today":
                return date.getTime() === today.getTime();
            case "week":
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 6);
                return date >= weekAgo && date <= today;
            case "month":
                const monthAgo = new Date(today);
                monthAgo.setDate(today.getDate() - 29);
                return date >= monthAgo && date <= today;
            case "overall":
            default:
                return true;
        }
    }, [period]);

    // Render Sparkline Chart
    const renderSparkline = React.useCallback((dataKey, color) => {
        if (graphData.length < 2 || period === 'today') return null;

        const chronologicalData = [...graphData].reverse();
        const data = chronologicalData.map(d => d[dataKey] || 0);
        
        if (data.length === 0 || data.every(v => v === 0)) return null;

        return (
            <LineChart
                series={[{
                    data: data,
                    area: true,
                    showMark: false,
                    curve: "monotoneX",
                    color: color,
                }]}
                xAxis={[{ data: data.map((_, i) => i), scaleType: 'point', hide: true }]}
                yAxis={[{ hide: true }]}
                height={60}
                width={200}
                margin={{ top: 5, bottom: 5, left: 5, right: 5 }}
                disableAxisListener
            />
        );
    }, [graphData, period]);

    // Aggregate graph data
    const aggregateGraphData = React.useCallback((filteredOrders, setCategoriesCallback) => {
        const orderDataByDay = filteredOrders.reduce((acc, doc) => {
            const data = doc.data();
            const dateObj = data.createdAt;
            if (!dateObj) return acc;
            
            const date = dateObj?.toDate ? dateObj.toDate() : new Date(dateObj);
            const dateKey = format(date, 'MM/dd');

            if (!acc[dateKey]) {
                acc[dateKey] = { date: dateKey, count: 0, totalRevenue: 0 };
            }
            acc[dateKey].count += 1;

            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    const category = item.category || 'Trend';
                    const itemRevenue = calculateItemRevenue(item);
                    acc[dateKey][category] = (acc[dateKey][category] || 0) + itemRevenue;
                    acc[dateKey].totalRevenue += itemRevenue;
                });
            }

            return acc;
        }, {});

        const sortedData = Object.values(orderDataByDay).sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA - dateB;
        });

        const allCategories = new Set();
        sortedData.forEach(day => {
            Object.keys(day).forEach(key => {
                if (key !== 'date' && key !== 'count' && key !== 'totalRevenue') {
                    allCategories.add(key);
                }
            });
        });
        
        const categoriesArray = Array.from(allCategories);
        setCategoriesCallback(categoriesArray);

        const finalData = sortedData.map(day => {
            const dayCopy = { ...day };
            categoriesArray.forEach(cat => {
                if (dayCopy[cat] === undefined) {
                    dayCopy[cat] = 0;
                }
            });
            return dayCopy;
        });

        return finalData;
    }, []);

    // Store all orders data for monthly calculation
    const [allOrdersData, setAllOrdersData] = React.useState([]);

    // Fetch analytics data
    React.useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const completedSnapshot = await getDocs(collection(db, "Completed_Orders"));
                const filteredCompleted = completedSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return isInPeriod(data.createdAt);
                });

                const chartData = aggregateGraphData(filteredCompleted, setCategories);
                const reversedData = [...chartData].reverse();
                const validatedData = reversedData.map(item => ({
                    ...item,
                    count: item.count || 0,
                    totalRevenue: item.totalRevenue || 0
                }));
                setGraphData(validatedData);

                // Get available years from all orders
                const yearSet = new Set();
                const ordersWithDates = [];
                
                filteredCompleted.forEach(doc => {
                    const data = doc.data();
                    const dateObj = data.createdAt;
                    if (!dateObj) return;
                    
                    const date = dateObj?.toDate ? dateObj.toDate() : new Date(dateObj);
                    const year = date.getFullYear();
                    yearSet.add(year);
                    
                    ordersWithDates.push({
                        date: date,
                        year: year,
                        month: date.getMonth() + 1,
                        data: data
                    });
                });
                
                setAllOrdersData(ordersWithDates);
                
                const yearsArray = Array.from(yearSet).sort((a, b) => b - a);
                setAvailableYears(yearsArray);
                
                // Set default selected year to most recent year if not set
                if (yearsArray.length > 0 && !yearsArray.includes(selectedYear)) {
                    setSelectedYear(yearsArray[0]);
                }

const totalRev = filteredCompleted.reduce((sum, doc) => {
    const data = doc.data();
    return sum + (Number(data.totalAmount) || 0);
}, 0);
setTotalRevenue(totalRev);
                setCompletedOrders(filteredCompleted.length);

const deliverySnapshot = await getDocs(collection(db, "To_Deliver_Orders"));
setDeliveryToday(deliverySnapshot.docs.length);


                const productsSnapshot = await getDocs(collection(db, "Products"));
                setTotalProducts(productsSnapshot.docs.length);

                const cancelledSnapshot = await getDocs(collection(db, "Cancelled_Orders"));
                const filteredCancelled = cancelledSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return isInPeriod(data.cancelledAt || data.createdAt);
                });
                setCancelledOrders(filteredCancelled.length);



                setPage(0);
            } catch (error) {
                console.error("Error fetching analytics data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [period, isInPeriod, aggregateGraphData]);

    // Calculate monthly data when selected year changes
    React.useEffect(() => {
        if (allOrdersData.length === 0) {
            setMonthlyData([]);
            return;
        }

        const monthMap = {};
        
        allOrdersData.forEach(order => {
            if (order.year === selectedYear) {
                const monthKey = order.month;
                if (!monthMap[monthKey]) {
                    monthMap[monthKey] = { 
                        year: selectedYear, 
                        month: monthKey, 
                        monthName: order.date.toLocaleString('default', { month: 'short' }),
                        count: 0, 
                        totalRevenue: 0 
                    };
                }
                monthMap[monthKey].count += 1;
                
                if (order.data.items && Array.isArray(order.data.items)) {
                    order.data.items.forEach(item => {
                        const itemRevenue = calculateItemRevenue(item);
                        monthMap[monthKey].totalRevenue += itemRevenue;
                    });
                }
            }
        });
        
        // Filter monthly data by selected year and ensure all 12 months are present
        const monthlyDataForYear = Object.values(monthMap)
            .sort((a, b) => a.month - b.month);
        
        // Ensure all 12 months are present (fill missing months with 0)
        const allMonths = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 1; i <= 12; i++) {
            const existing = monthlyDataForYear.find(m => m.month === i);
            if (existing) {
                allMonths.push(existing);
            } else {
                allMonths.push({
                    year: selectedYear,
                    month: i,
                    monthName: monthNames[i - 1],
                    count: 0,
                    totalRevenue: 0
                });
            }
        }
        
        setMonthlyData(allMonths);
    }, [selectedYear, allOrdersData]);

    // Pagination handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Calculate paginated data
    const paginatedData = React.useMemo(() => {
        return graphData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [graphData, page, rowsPerPage]);


    // Calculate pie data
    const pieData = React.useMemo(() => {
        const pieMap = {};
        const nonReversedGraphData = [...graphData].reverse();

        categories.forEach(category => {
            pieMap[category] = 0;
        });

        nonReversedGraphData.forEach(day => {
            categories.forEach(category => {
                if (day[category]) {
                    pieMap[category] = (pieMap[category] || 0) + day[category];
                }
            });
        });

        const total = Object.values(pieMap).reduce((sum, value) => sum + value, 0);

        return Object.keys(pieMap)
            .map((category, index) => ({
                id: index,
                value: pieMap[category],
                label: category,
                percentage: total > 0 ? (pieMap[category] / total) * 100 : 0,
            }))
            .sort((a, b) => b.value - a.value);
    }, [graphData, categories]);

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography>Loading analytics...</Typography>
            </Box>
        );
    }

    return (
        <Container 
            maxWidth={false}
            sx={{ 
                py: { xs: 2, sm: 3 }, 
                px: { xs: 1, sm: 2 },
                maxWidth: '100%',
                width: '100%',
                boxSizing: 'border-box',
                overflowX: 'hidden'
            }}
        >
            {/* Header */}
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Typography 
                    variant="h4" 
                    sx={{ 
                        fontWeight: 700, 
                        color: '#333',
                        fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
                        mb: 1,
                        borderBottom: '3px solid #7133ee',
                        pb: 1.5
                    }}
                >
                    Analytics Overview
                </Typography>
            </Box>

            {/* Period Filter */}
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Select 
                    value={period} 
                    onChange={(e) => setPeriod(e.target.value)} 
                    size="small"
                    sx={{
                        minWidth: { xs: '100%', sm: 200 },
                        backgroundColor: '#fff',
                        borderRadius: 1,
                    }}
                >
                    <MenuItem value="overall">Overall</MenuItem>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="week">Last 7 Days</MenuItem>
                    <MenuItem value="month">Last 30 Days</MenuItem>
                </Select>
            </Box>

            {/* Key Performance Indicators Section */}
            <Typography 
                variant="h5"
                sx={{ 
                    mb: { xs: 2, sm: 2.5 },
                    mt: { xs: 1, sm: 2 },
                    fontWeight: 700,
                    fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                    color: '#333'
                }}
            >
                Key Performance Indicators
            </Typography>

            {/* KPI Cards - 3 cards per row */}
            <Grid 
                container 
                spacing={{ xs: 2, sm: 2.5, md: 3 }} 
                sx={{ 
                    mb: { xs: 3, sm: 4 },
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    '& .MuiGrid-item': {
                        display: 'flex',
                        maxWidth: '100%',
                        boxSizing: 'border-box'
                    }
                }}
            >
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        icon={ICON_PATHS.CompletedOrders}
                        title="Completed Orders"
                        value={completedOrders}
                        color="#4caf50"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        icon={ICON_PATHS.DeliveryToday}
                        title={`Delivery ${period === 'today' ? 'Today' : 'in Period'}`}
                        value={deliveryToday}
                        color="#2196f3"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        icon={ICON_PATHS.TotalRevenue}
                        title="Total Revenue"
                        value={`₱${totalRevenue.toFixed(2)}`}
                        color="#f44336"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        icon={ICON_PATHS.Product}
                        title="Total Products"
                        value={totalProducts}
                        color="#9c27b0"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        icon={ICON_PATHS.Cancel}
                        title={`Cancelled (${period})`}
                        value={cancelledOrders}
                        color="#ff9800"
                    />
                </Grid>
               
            </Grid>

            {/* Completed Orders Trend Section */}
            {monthlyData.length > 0 && period !== 'today' && (
                <>
                    <Typography 
                        variant="h5"
                        sx={{ 
                            mb: { xs: 2, sm: 2.5 },
                            mt: { xs: 1, sm: 2 },
                            fontWeight: 700,
                            fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                            color: '#333'
                        }}
                    >
                        Completed Orders Trend
                    </Typography>
                    <Box sx={{ mb: { xs: 3, sm: 4 }, width: '100%' }}>
                        <Paper 
                            elevation={2}
                            sx={{ 
                                p: { xs: 2, sm: 3 },
                                borderRadius: 2,
                                backgroundColor: '#fafafa',
                                width: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                mb: 2,
                                flexWrap: 'wrap',
                                gap: 2
                            }}>
                                <Typography 
                                    variant="h6"
                                    sx={{ 
                                        fontWeight: 600,
                                        fontSize: { xs: '1rem', sm: '1.25rem' }
                                    }}
                                >
                                    Monthly Orders (By Year)
                                </Typography>
                            {availableYears.length > 0 && (
                                <Select 
                                    value={selectedYear} 
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))} 
                                    size="small"
                                    sx={{
                                        minWidth: { xs: '100%', sm: 150 },
                                        backgroundColor: '#fff',
                                        borderRadius: 1,
                                    }}
                                >
                                    {availableYears.map(year => (
                                        <MenuItem key={year} value={year}>
                                            {year}
                                        </MenuItem>
                                    ))}
                                </Select>
                            )}
                        </Box>
                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'center',
                            backgroundColor: '#fff',
                            borderRadius: 1,
                            p: { xs: 1, sm: 2 },
                            overflowX: 'auto',
                            width: '100%',
                            maxWidth: '100%',
                            minHeight: 400,
                            boxSizing: 'border-box'
                        }}>
                            <Box sx={{ 
                                width: '100%', 
                                maxWidth: '100%',
                                minWidth: { xs: '100%', sm: 600 },
                                boxSizing: 'border-box'
                            }}>
                                <LineChart
                                    dataset={monthlyData}
                                    xAxis={[{
                                        dataKey: 'monthName',
                                        scaleType: 'point',
                                        label: 'Month',
                                    }]}
                                    yAxis={[{
                                        label: 'Number of Orders',
                                        min: 0,
                                    }]}
                                    series={[{
                                        dataKey: 'count',
                                        label: 'Completed Orders',
                                        color: '#4caf50',
                                        showMark: true,
                                        curve: 'monotoneX',
                                        area: false,
                                        strokeWidth: 4,
                                    }]}
                                    width={undefined}
                                    height={400}
                                    margin={{ top: 30, right: 30, left: 60, bottom: 60 }}
                                    grid={{ vertical: true, horizontal: true }}
                                    slotProps={{
                                        legend: {
                                            position: { vertical: 'top', horizontal: 'right' },
                                        },
                                    }}
                                    sx={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </Box>
                        </Box>
                    </Paper>
                </Box>
                </>
            )}
        </Container>
    );
}
