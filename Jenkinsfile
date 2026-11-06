pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
    }

    stages {

        stage('Checkout Source Code') {
            steps {
                checkout scm
                echo 'Source code checkout completed'
            }
        }

        stage('Verify Git') {
            steps {
                sh '''
                    echo "===== GIT VERSION ====="
                    git --version

                    echo "===== LATEST COMMIT ====="
                    git log -1 --oneline

                    echo "===== WORKSPACE FILES ====="
                    ls -la
                '''
            }
        }

        stage('Docker Verification') {
            steps {
                sh '''
                    echo "===== DOCKER VERSION ====="
                    docker version

                    echo "===== DOCKER SMOKE TEST ====="
                    docker run --rm hello-world
                '''
            }
        }
    }

    post {
        success {
            echo 'CI pipeline completed successfully!'
        }

        failure {
            echo 'CI pipeline failed. Check the console logs.'
        }
    }
}
