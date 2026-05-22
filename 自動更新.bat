@echo off
chcp 65001 > nul
echo ===================================================
echo 🌐 海外テックニュース 自動更新システム 起動
echo ===================================================

echo.
echo [STEP 1/2] 🔄 最新ニュースを取得してAI要約中...
echo ---------------------------------------------------
:: node.jsを実行
call node app.js

if %errorlevel% neq 0 (
    echo.
    echo ❌ node app.js の実行中にエラーが発生しました。
    echo LM Studioが起動しているか確認してください。
    pause
    exit /b
)

echo.
echo [STEP 2/2] 🚀 更新されたホームページをネット(Vercel)へ公開中...
echo ---------------------------------------------------
:: Gitコマンドを連続実行
:: 「.」にすることで、新しく増えたarchiveフォルダの中身もすべて自動で対象になります
call git add .
call git commit -m "バッチファイルによる自動更新"
call git push origin main

if %errorlevel% neq 0 (
    echo.
    echo ❌ GitHubへのアップロードに失敗しました。
    pause
    exit /b
)

echo.
echo ===================================================
echo ✨ すべての処理が正常に完了しました！
echo Vercel側のサイトが自動的にアップデートされます。
echo ===================================================
timeout /t 5
