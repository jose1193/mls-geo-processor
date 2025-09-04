# 🚀 Optimized MLS Geocoding Processor

**High-Performance Pipeline for Processing 100K+ Records in 1 Hour**

## 📊 Performance Targets

- **Throughput**: 28+ records per second (100K records in 60 minutes)
- **Success Rate**: 95%+ geocoding accuracy
- **Memory Usage**: <2GB constant usage
- **Cache Hit Rate**: 80%+ with distributed caching
- **Vercel Compatible**: Works with hobby plan using queue system

## 🏗️ Architecture Overview

### Multi-API Strategy

- **Mapbox** (Primary): High accuracy, 600 req/min
- **Geocodio** (Fallback): Fast fallback, 1000 req/min
- **Gemini AI** (Enrichment): Neighborhood/community data, 1500 req/min
- **Supabase Cache**: Distributed caching layer

### Optimization Features

- ✅ **25 concurrent requests** (vs 3 in original)
- ✅ **Batch processing** (1000 records/batch)
- ✅ **Smart retry logic** with exponential backoff
- ✅ **Distributed caching** with 7-day TTL
- ✅ **Memory streaming** (no accumulation)
- ✅ **Real-time progress** tracking
- ✅ **Queue system** for Vercel deployment

## 🛠️ Installation

### 1. Install Dependencies

```bash
npm install p-queue p-retry p-limit p-map bottleneck @radix-ui/react-progress
```

### 2. Database Setup

Execute the Supabase setup script:

```sql
-- Run this in your Supabase SQL editor
\i supabase-mls-cache-setup.sql
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.optimized.example .env.local
```

Update `.env.local` with your API keys:

```env
# Required API Keys
NEXT_PUBLIC_MAPBOX_API_KEY=pk.your_mapbox_key
GEOCODIO_API_KEY=your_geocodio_key
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## 🔑 API Key Setup

### Mapbox

1. Visit [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Create token with **Geocoding** scope
3. Rate limit: 600 requests/minute

### Geocodio

1. Visit [Geocodio Dashboard](https://dash.geocod.io/apikey)
2. Get API key from dashboard
3. Rate limit: 1000 requests/minute

### Gemini AI

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key
3. Rate limit: 1500 requests/minute

### Supabase

1. Visit [Supabase Dashboard](https://app.supabase.com/)
2. Get Project URL and Anon Key
3. Run the cache setup SQL script

## 🚀 Usage

### 1. Start the Application

```bash
npm run dev
```

### 2. Navigate to Optimized Processor

Go to: `http://localhost:3000/mls-processor-optimized`

### 3. Configure Processing

- **Batch Size**: 1000 records (recommended)
- **Concurrency**: 25 concurrent requests
- **Max Retries**: 3 attempts per request

### 4. Upload and Process

1. Upload Excel file with MLS data
2. Verify column mapping (address, city, county, zip)
3. Click "Start Processing"
4. Monitor real-time progress and performance

## 📈 Performance Monitoring

### Real-Time Metrics

- **Throughput**: Records per second
- **Success Rate**: Percentage of successful geocoding
- **Cache Hit Rate**: Percentage of cached results
- **API Usage**: Requests per service
- **Memory Usage**: Current memory consumption
- **ETA**: Estimated completion time

### Performance Dashboard

The optimized processor includes:

- Real-time progress bars
- Batch completion tracking
- API usage statistics
- Performance bottleneck identification
- Error rate monitoring

## 🎯 Optimization Tips

### For Localhost Development

```env
# Aggressive settings for local testing
MAX_CONCURRENT_REQUESTS=30
BATCH_SIZE=1000
NODE_OPTIONS="--max-old-space-size=4096"
```

### For Vercel Production

```env
# Conservative settings for serverless
MAX_CONCURRENT_REQUESTS=20
BATCH_SIZE=500
ENABLE_QUEUE_PROCESSING=true
```

### Cache Optimization

- **Pre-populate** common Florida cities/counties
- **Enable distributed caching** for multi-instance scaling
- **Set appropriate TTL** (7 days for geocoding, 30 days for Gemini)

## 🔧 Advanced Configuration

### Batch Processing Settings

```typescript
const batchConfig = {
  batchSize: 1000, // Records per batch
  concurrencyLimit: 25, // Concurrent requests
  maxRetries: 3, // Retry attempts
  retryDelayMs: 1000, // Initial retry delay
  enableCache: true, // Use distributed cache
  cacheExpiryHours: 168, // 7 days cache TTL
};
```

### Performance Tuning

```typescript
const OPTIMIZED_CONFIG = {
  DELAY_BETWEEN_REQUESTS: 0, // No artificial delays
  CONCURRENCY_LIMIT: 25, // Max concurrent requests
  BATCH_SIZE: 1000, // Records per batch
  QUEUE_CONCURRENCY: 30, // Queue processing limit
  TARGET_THROUGHPUT: 28, // Records/second target
  MEMORY_CLEANUP_INTERVAL: 10000, // Memory cleanup frequency
};
```

## 📊 Expected Performance

### 100K Records Scenario

- **Processing Time**: 45-60 minutes
- **API Requests**:
  - Mapbox: ~40K requests
  - Geocodio: ~30K requests
  - Gemini: ~80K requests
  - Cache hits: ~50K (50% hit rate)
- **Memory Usage**: 1-2GB peak
- **Success Rate**: 95-98%

### Scaling Considerations

- **10K records**: 2-3 minutes
- **50K records**: 20-30 minutes
- **250K records**: 2-3 hours
- **500K records**: 4-6 hours (requires queue system)

## 🐛 Troubleshooting

### Common Issues

#### Rate Limiting

```
Error: Rate limited by [API]
Solution: Increase retry delays or reduce concurrency
```

#### Memory Issues

```
Error: JavaScript heap out of memory
Solution: Increase NODE_OPTIONS="--max-old-space-size=4096"
```

#### Vercel Timeouts

```
Error: Function timeout
Solution: Enable queue processing for large datasets
```

### Performance Debugging

#### Low Throughput

1. Check API rate limits
2. Reduce batch size
3. Increase concurrency (if APIs allow)
4. Verify cache hit rate

#### High Error Rate

1. Check API key validity
2. Verify rate limit settings
3. Review retry configuration
4. Monitor network connectivity

## 📝 File Structure

```
app/
├── mls-processor-optimized/
│   └── page.tsx                    # Main optimized page
├── mls-processor/
│   ├── hooks/
│   │   └── useMLSProcessor-optimized.ts  # Optimized hook
│   └── components/
│       └── OptimizedMLSProcessor.tsx     # UI component
└── api/
    └── geocoding/
        ├── mapbox/route.ts         # Mapbox API
        ├── geocodio/route.ts       # Geocodio API
        └── gemini-optimized/route.ts # Optimized Gemini API

supabase-mls-cache-setup.sql       # Database setup
.env.optimized.example              # Environment template
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/optimization`
3. Test with sample datasets
4. Submit pull request with performance metrics

## 📄 License

MIT License - See LICENSE file for details

---

## 🎉 Ready to Process 100K Records?

1. ✅ Install dependencies
2. ✅ Setup database tables
3. ✅ Configure API keys
4. ✅ Start the optimized processor
5. ✅ Upload your MLS data
6. 🚀 **Process 100K records in under 1 hour!**
